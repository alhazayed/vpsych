/**
 * Two-stage endpoint controller (Human Conversation Fidelity).
 *
 * Stage 1 — the energy VAD reports a PAUSE (silence ≥ speculativePauseMs) and keeps
 *           the microphone open. The controller transcribes the audio so far
 *           speculatively.
 * Stage 2 — the speculative transcript is classified (complete / incomplete /
 *           uncertain). Complete thoughts commit right away; unfinished ones
 *           wait for more silence, bounded by ENDPOINT_TIMING.maxSilenceMs.
 *
 * If the therapist RESUMES speaking at any point before commit, the pending
 * endpoint is cancelled, the in-flight speculative STT is aborted, and any
 * late result is discarded by capture version — nothing is submitted, so no
 * message is persisted for a half-thought.
 *
 * On commit the speculative transcript is reused for the message API (one STT
 * call per turn in the common case). The authoritative STT remains OpenAI via
 * /api/voice/transcribe; this module only decides WHEN.
 *
 * Pure orchestration: timers, clock and STT are injected for tests.
 */

import {
  ENDPOINT_TIMING,
  classifyUtteranceCompleteness,
  decideEndpoint,
  type EndpointLocale,
  type EndpointTiming,
  type UtteranceCompleteness,
} from "@/lib/voice/endpointing";

export type SpeculativeSttResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string; unavailable: boolean; code?: string };

export type EndpointCommitReason =
  | "complete_thought"
  | "silence_budget_met"
  | "stt_failed"
  | "vad_finished";

export type EndpointControllerEvent =
  | { type: "pause"; at: number }
  | { type: "resumed"; at: number; hadSpeculativeStt: boolean }
  | {
      type: "classified";
      at: number;
      completeness: UtteranceCompleteness;
      requiredSilenceMs: number;
    }
  | { type: "commit"; at: number; reason: EndpointCommitReason; silenceMs: number };

export type EndpointFinalization = {
  /**
   * Speculative STT result for exactly the committed audio, or null when it
   * must be re-transcribed (speech resumed after the snapshot / STT failed /
   * no pause was ever detected).
   */
  stt: SpeculativeSttResult | null;
  completeness: UtteranceCompleteness | null;
};

export type EndpointController = {
  /** VAD stage 1: pause detected; `wav` holds all audio captured so far. */
  pause: (params: { wav: Blob; speechMs: number; silenceStartedAt: number }) => void;
  /** VAD: therapist resumed speaking during a pending endpoint. */
  resumed: () => void;
  /**
   * VAD: voiced audio is present but not yet confirmed as resumed speech.
   * While active, commit is deferred so confirmation latency can never let a
   * commit slip in front of a real resume. `false` releases the hold.
   */
  activity: (active: boolean) => void;
  /**
   * Called after the capture finished (commit, max silence, or max length).
   * Awaits an in-flight speculative STT for the CURRENT capture version.
   */
  finalize: () => Promise<EndpointFinalization>;
  /** Abort everything (pause / end / unmount). */
  cancel: () => void;
  /** True while a pause is pending (between pause() and resume/commit). */
  isPending: () => boolean;
};

export function createEndpointController(params: {
  locale: EndpointLocale;
  transcribe: (wav: Blob, signal: AbortSignal) => Promise<SpeculativeSttResult>;
  /** Called once when the endpoint should commit; caller stops the VAD. */
  onCommit: (reason: EndpointCommitReason) => void;
  onEvent?: (event: EndpointControllerEvent) => void;
  timing?: Partial<EndpointTiming>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): EndpointController {
  const now = params.now ?? (() => performance.now());
  const setTimer =
    params.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    params.clearTimer ??
    ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const emit = (event: EndpointControllerEvent) => {
    try {
      params.onEvent?.(event);
    } catch {
      /* telemetry must never break turn-taking */
    }
  };

  /** Incremented on every resume; speculative results carry the version. */
  let version = 0;
  let pending = false;
  let committed = false;
  let cancelled = false;
  let silenceStartedAt = 0;
  let speechMs = 0;
  let timer: unknown = null;
  let abort: AbortController | null = null;
  let speculative: {
    version: number;
    promise: Promise<SpeculativeSttResult>;
    result: SpeculativeSttResult | null;
  } | null = null;
  let completeness: UtteranceCompleteness | null = null;
  let activityHold = false;
  let deferredCommit: EndpointCommitReason | null = null;

  const clearPendingTimer = () => {
    if (timer != null) {
      clearTimer(timer);
      timer = null;
    }
  };

  const commit = (reason: EndpointCommitReason) => {
    if (committed || cancelled) return;
    if (activityHold) {
      deferredCommit = reason;
      return;
    }
    committed = true;
    pending = false;
    clearPendingTimer();
    emit({
      type: "commit",
      at: now(),
      reason,
      silenceMs: Math.max(0, Math.round(now() - silenceStartedAt)),
    });
    params.onCommit(reason);
  };

  /** Commit once the silence reaches `ms`; never sooner (pause may be early). */
  const commitAfterSilence = (
    forVersion: number,
    ms: number,
    reason: EndpointCommitReason,
  ) => {
    const remainingMs = ms - (now() - silenceStartedAt);
    if (remainingMs <= 0) {
      commit(reason);
      return;
    }
    clearPendingTimer();
    timer = setTimer(() => {
      timer = null;
      if (forVersion === version && pending) commit(reason);
    }, remainingMs);
  };

  const evaluate = (forVersion: number, result: SpeculativeSttResult) => {
    if (committed || cancelled || forVersion !== version || !pending) return;
    const floorMs = params.timing?.completeSilenceMs ?? ENDPOINT_TIMING.completeSilenceMs;
    if (!result.ok) {
      // Fall back to the classic path: commit and let the normal STT stage
      // retry + surface errors through the existing FSM. The pause can fire
      // before a finished thought may commit, so wait for that floor.
      commitAfterSilence(forVersion, floorMs, "stt_failed");
      return;
    }
    const transcript = result.transcript.trim();
    if (!transcript) {
      // Noise-only capture: no linguistic reason to wait longer.
      completeness = "complete";
      commitAfterSilence(forVersion, floorMs, "silence_budget_met");
      return;
    }
    completeness = classifyUtteranceCompleteness(transcript);
    const silenceMs = now() - silenceStartedAt;
    const decision = decideEndpoint({
      completeness,
      speechMs,
      silenceMs,
      timing: params.timing,
    });
    emit({
      type: "classified",
      at: now(),
      completeness,
      requiredSilenceMs: decision.requiredSilenceMs,
    });
    const reason: EndpointCommitReason =
      completeness === "complete" ? "complete_thought" : "silence_budget_met";
    if (decision.action === "commit") {
      commit(reason);
      return;
    }
    commitAfterSilence(forVersion, decision.requiredSilenceMs, reason);
  };

  return {
    pause({ wav, speechMs: voicedMs, silenceStartedAt: startedAt }) {
      if (committed || cancelled || pending) return;
      pending = true;
      activityHold = false;
      deferredCommit = null;
      silenceStartedAt = startedAt;
      speechMs = voicedMs;
      completeness = null;
      emit({ type: "pause", at: now() });

      abort?.abort();
      abort = new AbortController();
      const myVersion = version;
      const signal = abort.signal;
      const promise = params
        .transcribe(wav, signal)
        .catch(
          (): SpeculativeSttResult => ({
            ok: false,
            error: "speculative_stt_failed",
            unavailable: false,
          }),
        );
      const entry = { version: myVersion, promise, result: null as SpeculativeSttResult | null };
      speculative = entry;
      void promise.then((result) => {
        if (signal.aborted) return;
        entry.result = result;
        evaluate(myVersion, result);
      });
    },

    resumed() {
      if (committed || cancelled || !pending) return;
      pending = false;
      version += 1;
      clearPendingTimer();
      const hadSpeculativeStt = speculative != null;
      abort?.abort();
      abort = null;
      speculative = null;
      completeness = null;
      activityHold = false;
      deferredCommit = null;
      emit({ type: "resumed", at: now(), hadSpeculativeStt });
    },

    activity(active) {
      if (committed || cancelled) return;
      if (active) {
        if (pending) activityHold = true;
        return;
      }
      activityHold = false;
      const reason = deferredCommit;
      deferredCommit = null;
      if (reason && pending) commit(reason);
    },

    async finalize() {
      clearPendingTimer();
      if (!committed && !cancelled) {
        committed = true;
        pending = false;
        emit({
          type: "commit",
          at: now(),
          reason: "vad_finished",
          silenceMs: Math.max(0, Math.round(now() - silenceStartedAt)),
        });
      }
      const entry = speculative;
      if (cancelled || !entry || entry.version !== version) {
        return { stt: null, completeness: null };
      }
      const result = entry.result ?? (await entry.promise);
      if (cancelled || entry.version !== version) {
        return { stt: null, completeness: null };
      }
      // A failed speculative pass is retried by the normal STT stage.
      if (!result.ok) return { stt: null, completeness: null };
      return { stt: result, completeness };
    },

    cancel() {
      cancelled = true;
      pending = false;
      clearPendingTimer();
      abort?.abort();
      abort = null;
      speculative = null;
    },

    isPending: () => pending,
  };
}

/**
 * Hands-free conversation telemetry — timings and counters only.
 * Never records raw audio, transcripts, or other PHI.
 */

import {
  resolveTurnTakingConfig,
  TURN_TAKING_DEFAULTS,
} from "./turn-taking-config";

export type ConversationTelemetryKind =
  | "speech_duration_ms"
  | "stt_latency_ms"
  | "gpt_latency_ms"
  | "tts_latency_ms"
  | "playback_duration_ms"
  | "mic_reopen_latency_ms"
  | "turn_complete"
  | "barge_in"
  | "error"
  | "retry"
  | "pause"
  | "resume"
  | "session_start"
  | "session_end"
  /** Two-stage endpoint: Stage-1 silence reached (candidate). */
  | "endpoint_candidate"
  /** Two-stage endpoint: Stage-2 confirmed — turn may commit to STT. */
  | "endpoint_confirmed"
  /** Therapist resumed during confirmation — candidate cancelled. */
  | "endpoint_cancelled"
  /** Therapist speech while STT/GPT in flight — pending response aborted. */
  | "therapist_resumed"
  /** TTS playback aborted (barge-in or stale). */
  | "tts_cancelled"
  /** Stale generation blocked from playing / committing. */
  | "stale_response_blocked";

export type ConversationTelemetryEvent = {
  kind: ConversationTelemetryKind;
  /** Milliseconds for latency / duration events; omit for counters. */
  valueMs?: number;
  /** Non-PHI error / event code (e.g. stt_timeout, fsm_listening). */
  code?: string;
  /** Opaque turn / generation id — never transcript content. */
  turnId?: number;
  /** FSM state name at event time (non-PHI). */
  fsmState?: string;
  at: number;
};

export type ConversationTelemetrySummary = {
  turns: number;
  bargeIns: number;
  errors: number;
  retries: number;
  pauses: number;
  endpointCandidates: number;
  endpointConfirmed: number;
  endpointCancelled: number;
  therapistResumed: number;
  ttsCancelled: number;
  staleResponseBlocked: number;
  avgSpeechMs: number | null;
  avgSttMs: number | null;
  avgGptMs: number | null;
  avgTtsMs: number | null;
  avgPlaybackMs: number | null;
  avgMicReopenMs: number | null;
  events: ConversationTelemetryEvent[];
};

function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function createConversationTelemetry(): {
  record: (
    kind: ConversationTelemetryKind,
    opts?: {
      valueMs?: number;
      code?: string;
      turnId?: number;
      fsmState?: string;
    },
  ) => void;
  mark: () => number;
  elapsed: (startedAt: number) => number;
  summarize: () => ConversationTelemetrySummary;
  /** Strip events array for session persistence / immersion merge. */
  countersOnly: () => Omit<ConversationTelemetrySummary, "events">;
} {
  const events: ConversationTelemetryEvent[] = [];

  const record = (
    kind: ConversationTelemetryKind,
    opts?: {
      valueMs?: number;
      code?: string;
      turnId?: number;
      fsmState?: string;
    },
  ) => {
    events.push({
      kind,
      valueMs:
        opts?.valueMs != null && Number.isFinite(opts.valueMs)
          ? Math.max(0, Math.round(opts.valueMs))
          : undefined,
      code: opts?.code,
      turnId:
        opts?.turnId != null && Number.isFinite(opts.turnId)
          ? Math.trunc(opts.turnId)
          : undefined,
      fsmState: opts?.fsmState,
      at: Date.now(),
    });
  };

  return {
    record,
    mark: () => performance.now(),
    elapsed: (startedAt) => performance.now() - startedAt,
    summarize() {
      const speech: number[] = [];
      const stt: number[] = [];
      const gpt: number[] = [];
      const tts: number[] = [];
      const playback: number[] = [];
      const micReopen: number[] = [];
      let turns = 0;
      let bargeIns = 0;
      let errors = 0;
      let retries = 0;
      let pauses = 0;
      let endpointCandidates = 0;
      let endpointConfirmed = 0;
      let endpointCancelled = 0;
      let therapistResumed = 0;
      let ttsCancelled = 0;
      let staleResponseBlocked = 0;

      for (const e of events) {
        switch (e.kind) {
          case "speech_duration_ms":
            if (e.valueMs != null) speech.push(e.valueMs);
            break;
          case "stt_latency_ms":
            if (e.valueMs != null) stt.push(e.valueMs);
            break;
          case "gpt_latency_ms":
            if (e.valueMs != null) gpt.push(e.valueMs);
            break;
          case "tts_latency_ms":
            if (e.valueMs != null) tts.push(e.valueMs);
            break;
          case "playback_duration_ms":
            if (e.valueMs != null) playback.push(e.valueMs);
            break;
          case "mic_reopen_latency_ms":
            if (e.valueMs != null) micReopen.push(e.valueMs);
            break;
          case "turn_complete":
            turns += 1;
            break;
          case "barge_in":
            bargeIns += 1;
            break;
          case "error":
            errors += 1;
            break;
          case "retry":
            retries += 1;
            break;
          case "pause":
            pauses += 1;
            break;
          case "endpoint_candidate":
            endpointCandidates += 1;
            break;
          case "endpoint_confirmed":
            endpointConfirmed += 1;
            break;
          case "endpoint_cancelled":
            endpointCancelled += 1;
            break;
          case "therapist_resumed":
            therapistResumed += 1;
            break;
          case "tts_cancelled":
            ttsCancelled += 1;
            break;
          case "stale_response_blocked":
            staleResponseBlocked += 1;
            break;
          default:
            break;
        }
      }

      return {
        turns,
        bargeIns,
        errors,
        retries,
        pauses,
        endpointCandidates,
        endpointConfirmed,
        endpointCancelled,
        therapistResumed,
        ttsCancelled,
        staleResponseBlocked,
        avgSpeechMs: avgOf(speech),
        avgSttMs: avgOf(stt),
        avgGptMs: avgOf(gpt),
        avgTtsMs: avgOf(tts),
        avgPlaybackMs: avgOf(playback),
        avgMicReopenMs: avgOf(micReopen),
        events: [...events],
      };
    },
    countersOnly() {
      const full = this.summarize();
      return {
        turns: full.turns,
        bargeIns: full.bargeIns,
        errors: full.errors,
        retries: full.retries,
        pauses: full.pauses,
        endpointCandidates: full.endpointCandidates,
        endpointConfirmed: full.endpointConfirmed,
        endpointCancelled: full.endpointCancelled,
        therapistResumed: full.therapistResumed,
        ttsCancelled: full.ttsCancelled,
        staleResponseBlocked: full.staleResponseBlocked,
        avgSpeechMs: full.avgSpeechMs,
        avgSttMs: full.avgSttMs,
        avgGptMs: full.avgGptMs,
        avgTtsMs: full.avgTtsMs,
        avgPlaybackMs: full.avgPlaybackMs,
        avgMicReopenMs: full.avgMicReopenMs,
      };
    },
  };
}

export type ConversationTelemetry = ReturnType<
  typeof createConversationTelemetry
>;

/**
 * Performance / endpoint budgets for hands-free mode.
 * Derived from turn-taking config (clinical wait bias).
 * Legacy field names preserved for callers.
 */
export function getHandsFreePerfBudgets() {
  const cfg = resolveTurnTakingConfig();
  return {
    speechEndToSttStartMs: cfg.speechEndToSttStartMs,
    micReopenAfterPlaybackMs: cfg.micReopenAfterPlaybackMs,
    /** Stage-1 minimum (candidate). */
    silenceDetectMsMin: TURN_TAKING_DEFAULTS.endpointInitialMsMin,
    /** Stage-1 maximum (candidate). */
    silenceDetectMsMax: TURN_TAKING_DEFAULTS.endpointInitialMsMax,
    /** Default Stage-1 silence (candidate). */
    defaultSilenceMs: cfg.endpointInitialMs,
    /** Stage-2 confirmation silence. */
    endpointConfirmMs: cfg.endpointConfirmMs,
    /** Total quiet to commit endpoint. */
    endpointCommitMs: cfg.endpointInitialMs + cfg.endpointConfirmMs,
    endpointMaxWaitMs: cfg.endpointMaxWaitMs,
    minSpeechMs: cfg.minSpeechMs,
  } as const;
}

/** Snapshot at module load — prefer getHandsFreePerfBudgets() when env may change. */
export const HANDS_FREE_PERF_BUDGETS = getHandsFreePerfBudgets();

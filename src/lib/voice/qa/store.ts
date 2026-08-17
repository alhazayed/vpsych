/**
 * In-memory capture store for Voice QA — DEVELOPMENT ONLY.
 *
 * Deliberately volatile. Captured turns hold raw clinical speech and raw
 * patient audio, so they live in a bounded ring buffer in browser memory and
 * nowhere else: no database, no localStorage, no IndexedDB, no upload. Closing
 * the tab destroys them, which is the intended retention policy.
 *
 * The factory is exported separately from the module singleton so the logic is
 * testable in node without a DOM.
 */

import { summarizeLatency } from "@/lib/voice/qa/latency";
import type {
  VoiceQaOutcome,
  VoiceQaSegment,
  VoiceQaSink,
  VoiceQaStage,
  VoiceQaTurn,
} from "@/lib/voice/qa/types";
import type { SessionSpeechLocale } from "@/lib/voice/config";

/** Bounded so a long session cannot grow browser memory without limit. */
export const VOICE_QA_MAX_TURNS = 12;

export type VoiceQaStore = {
  beginTurn: (locale: SessionSpeechLocale) => VoiceQaSink;
  /**
   * Stable snapshot. Returns the SAME array reference until something changes,
   * so it can back `useSyncExternalStore` without re-rendering forever.
   */
  list: () => VoiceQaTurn[];
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
};

/** Monotonic where available; `Date.now` is not safe for durations. */
function now(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function header(headers: Headers | null, name: string): string | null {
  return headers?.get(name) ?? null;
}

/**
 * Best-effort decoded duration. Metadata-only, and it never rejects: a browser
 * that will not decode the clip simply leaves the field null rather than
 * failing the capture.
 */
async function measureDuration(blob: Blob): Promise<number | null> {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<number | null>((resolve) => {
      const audio = new Audio();
      let settled = false;
      // Bare `setTimeout`, not `window.setTimeout` — and always cleared, so a
      // decoded clip does not leave a 3s timer pending per segment.
      const done = (value: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      audio.preload = "metadata";
      audio.onloadedmetadata = () =>
        done(Number.isFinite(audio.duration) ? audio.duration : null);
      audio.onerror = () => done(null);
      // Armed before `src` is assigned, so a synchronous decode error cannot
      // reach `done` while `timer` is still in its temporal dead zone.
      const timer = setTimeout(() => done(null), 3000);
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createVoiceQaStore(
  options: { maxTurns?: number } = {},
): VoiceQaStore {
  const maxTurns = options.maxTurns ?? VOICE_QA_MAX_TURNS;
  const turns: VoiceQaTurn[] = [];
  const listeners = new Set<() => void>();
  let seq = 0;
  // Captures are mutated in place as a turn progresses, so the snapshot is
  // rebuilt on every notify rather than derived lazily.
  let snapshot: VoiceQaTurn[] = [];

  const notify = () => {
    snapshot = [...turns];
    for (const listener of listeners) listener();
  };

  const beginTurn = (locale: SessionSpeechLocale): VoiceQaSink => {
    const turn: VoiceQaTurn = {
      id: `qa-${++seq}-${Math.random().toString(36).slice(2, 8)}`,
      startedAt: new Date().toISOString(),
      locale,
      therapistText: null,
      displayText: null,
      speechText: null,
      speechChanged: null,
      segments: [],
      marks: {},
      latency: summarizeLatency({}),
      outcome: null,
    };

    let thinkingPauseMs: number | null = null;
    turns.unshift(turn);
    while (turns.length > maxTurns) turns.pop();
    notify();

    const recompute = () => {
      turn.latency = summarizeLatency(turn.marks, thinkingPauseMs);
    };

    return {
      mark(stage: VoiceQaStage) {
        // First write wins: a retried stage must not overwrite the real start.
        if (turn.marks[stage] === undefined) turn.marks[stage] = now();
        recompute();
        notify();
      },
      setTherapistText(text) {
        turn.therapistText = text;
        notify();
      },
      setSpeech(speech) {
        turn.displayText = speech.displayText;
        turn.speechText = speech.speechText;
        turn.speechChanged = speech.changed;
        turn.locale = speech.locale;
        turn.segments = speech.segments.map(
          (segment): VoiceQaSegment => ({
            index: segment.index,
            text: segment.text,
            boundary: segment.boundary,
            pauseAfterMs: segment.pauseAfterMs,
            blob: null,
            byteLength: null,
            durationSec: null,
            synthesisMs: null,
            provider: "elevenlabs",
            voiceId: null,
            model: null,
            voiceProfileId: null,
            voiceSource: null,
            emotion: null,
            cached: null,
          }),
        );
        notify();
      },
      setThinkingPauseMs(ms) {
        thinkingPauseMs = ms;
        recompute();
        notify();
      },
      captureSegmentAudio({ index, blob, headers, synthesisMs }) {
        const segment = turn.segments[index];
        if (!segment) return;
        segment.blob = blob;
        segment.byteLength = blob?.size ?? null;
        segment.synthesisMs = Math.round(synthesisMs);
        segment.provider = blob ? "elevenlabs" : "browser";
        segment.voiceId = header(headers, "X-Voice-Id");
        segment.model = header(headers, "X-Voice-Model");
        segment.voiceProfileId = header(headers, "X-Voice-Profile-Id");
        segment.voiceSource = header(headers, "X-Voice-Source");
        segment.emotion = header(headers, "X-Voice-Emotion");
        const cached = header(headers, "X-Voice-Cached");
        segment.cached = cached === null ? null : cached === "1";
        notify();

        if (blob) {
          void measureDuration(blob).then((duration) => {
            segment.durationSec = duration;
            notify();
          });
        }
      },
      finish(outcome: VoiceQaOutcome) {
        turn.outcome = outcome;
        recompute();
        notify();
      },
    };
  };

  return {
    beginTurn,
    list: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clear() {
      turns.length = 0;
      notify();
    },
  };
}

/** Process-wide store for the running client session. */
export const voiceQaStore = createVoiceQaStore();

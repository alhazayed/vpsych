/**
 * Hands-free conversation telemetry — timings and counters only.
 * Never records raw audio, transcripts, or other PHI.
 */

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
  | "session_end";

export type ConversationTelemetryEvent = {
  kind: ConversationTelemetryKind;
  /** Milliseconds for latency / duration events; omit for counters. */
  valueMs?: number;
  /** Non-PHI error code (e.g. stt_timeout, mic_denied). */
  code?: string;
  at: number;
};

export type ConversationTelemetrySummary = {
  turns: number;
  bargeIns: number;
  errors: number;
  retries: number;
  pauses: number;
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
    opts?: { valueMs?: number; code?: string },
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
    opts?: { valueMs?: number; code?: string },
  ) => {
    events.push({
      kind,
      valueMs:
        opts?.valueMs != null && Number.isFinite(opts.valueMs)
          ? Math.max(0, Math.round(opts.valueMs))
          : undefined,
      code: opts?.code,
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

/** Performance budgets from the hands-free mission (ms). Documented targets. */
export const HANDS_FREE_PERF_BUDGETS = {
  speechEndToSttStartMs: 200,
  micReopenAfterPlaybackMs: 300,
  silenceDetectMsMin: 700,
  silenceDetectMsMax: 1000,
  defaultSilenceMs: 850,
} as const;

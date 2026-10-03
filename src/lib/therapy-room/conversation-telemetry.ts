/**
 * Hands-free conversation telemetry — timings and counters only.
 * Never records raw audio, transcripts, or other PHI.
 */

export type ConversationTelemetryKind =
  | "speech_duration_ms"
  | "stt_latency_ms"
  | "gpt_latency_ms"
  /** @deprecated Prefer tts_generation_latency_ms — kept as generation-only alias. */
  | "tts_latency_ms"
  | "tts_generation_latency_ms"
  /**
   * Wall ms until first patient audio play() resolved successfully
   * (playback initiation confirmed). Not recorded on mere play() attempt
   * or when play() rejects (e.g. NotAllowedError).
   */
  | "time_to_first_patient_audio_ms"
  | "patient_playback_duration_ms"
  | "playback_duration_ms"
  | "tts_playback_path"
  | "mic_reopen_latency_ms"
  | "turn_complete"
  | "barge_in"
  | "error"
  | "retry"
  | "pause"
  | "resume"
  | "session_start"
  | "session_end"
  /* Human Conversation Fidelity — timings / counters only, never content. */
  /** Stage-1 pause detected while the therapist holds the floor. */
  | "endpoint_pause"
  /** Therapist resumed during a pending endpoint (premature submit avoided). */
  | "endpoint_resumed"
  /** Trailing silence actually waited before commit (ms); code = reason. */
  | "endpoint_commit_silence_ms"
  /** Commit forced by the max-silence ceiling rather than a decision. */
  | "endpoint_max_silence_commit"
  /** Speculative STT transcript reused for the message API (code = completeness). */
  | "speculative_stt_reused"
  /** Therapist speech onset → barge-in detection (ms). */
  | "barge_in_detect_ms"
  /** Barge-in detection → patient audio paused (ms, main-thread). */
  | "barge_in_stop_ms"
  /** Therapist took the floor before the patient reply started. */
  | "floor_yield"
  /** A reply held during floor-take was replayed (therapist said nothing). */
  | "held_reply_played"
  /** Late async result dropped by turn fence / generation (count). */
  | "stale_result_discarded"
  /** Progressive TTS chunks requested / played (count). */
  | "tts_chunks_generated"
  | "tts_chunks_played"
  /** TTS chunk synthesis failure (count) / play() rejection (count). */
  | "tts_failure"
  | "playback_failure";

export type ConversationTelemetryEvent = {
  kind: ConversationTelemetryKind;
  /** Milliseconds for latency / duration events; omit for counters. */
  valueMs?: number;
  /** Non-PHI error code (e.g. stt_timeout, mic_denied) or path tag. */
  code?: string;
  /** Non-PHI integer count (chunk counters). */
  count?: number;
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
  /** Average TTS generation latency (not full playback). */
  avgTtsMs: number | null;
  avgTimeToFirstAudioMs: number | null;
  avgPlaybackMs: number | null;
  avgMicReopenMs: number | null;
  /** Human Conversation Fidelity aggregates (no content). */
  endpointPauses: number;
  endpointResumes: number;
  avgEndpointCommitSilenceMs: number | null;
  endpointMaxSilenceCommits: number;
  speculativeSttReused: number;
  avgBargeInDetectMs: number | null;
  avgBargeInStopMs: number | null;
  floorYields: number;
  heldRepliesPlayed: number;
  staleResultsDiscarded: number;
  ttsChunksGenerated: number;
  ttsChunksPlayed: number;
  ttsFailures: number;
  playbackFailures: number;
  events: ConversationTelemetryEvent[];
};

function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function createConversationTelemetry(): {
  record: (
    kind: ConversationTelemetryKind,
    opts?: { valueMs?: number; code?: string; count?: number },
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
    opts?: { valueMs?: number; code?: string; count?: number },
  ) => {
    events.push({
      kind,
      valueMs:
        opts?.valueMs != null && Number.isFinite(opts.valueMs)
          ? Math.max(0, Math.round(opts.valueMs))
          : undefined,
      code: opts?.code,
      count:
        opts?.count != null && Number.isFinite(opts.count)
          ? Math.max(0, Math.round(opts.count))
          : undefined,
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
      const firstAudio: number[] = [];
      const playback: number[] = [];
      const micReopen: number[] = [];
      let turns = 0;
      let bargeIns = 0;
      let errors = 0;
      let retries = 0;
      let pauses = 0;
      const endpointSilence: number[] = [];
      const bargeDetect: number[] = [];
      const bargeStop: number[] = [];
      let endpointPauses = 0;
      let endpointResumes = 0;
      let endpointMaxSilenceCommits = 0;
      let speculativeSttReused = 0;
      let floorYields = 0;
      let heldRepliesPlayed = 0;
      let staleResultsDiscarded = 0;
      let ttsChunksGenerated = 0;
      let ttsChunksPlayed = 0;
      let ttsFailures = 0;
      let playbackFailures = 0;
      const countOf = (e: ConversationTelemetryEvent) => e.count ?? 1;

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
          case "time_to_first_patient_audio_ms":
            if (e.valueMs != null) firstAudio.push(e.valueMs);
            break;
          case "patient_playback_duration_ms":
            if (e.valueMs != null) playback.push(e.valueMs);
            break;
          case "playback_duration_ms":
            // Legacy alias — ignored when patient_playback_duration_ms is present.
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
          case "endpoint_pause":
            endpointPauses += 1;
            break;
          case "endpoint_resumed":
            endpointResumes += 1;
            break;
          case "endpoint_commit_silence_ms":
            if (e.valueMs != null) endpointSilence.push(e.valueMs);
            break;
          case "endpoint_max_silence_commit":
            endpointMaxSilenceCommits += 1;
            break;
          case "speculative_stt_reused":
            speculativeSttReused += 1;
            break;
          case "barge_in_detect_ms":
            if (e.valueMs != null) bargeDetect.push(e.valueMs);
            break;
          case "barge_in_stop_ms":
            if (e.valueMs != null) bargeStop.push(e.valueMs);
            break;
          case "floor_yield":
            floorYields += 1;
            break;
          case "held_reply_played":
            heldRepliesPlayed += 1;
            break;
          case "stale_result_discarded":
            staleResultsDiscarded += countOf(e);
            break;
          case "tts_chunks_generated":
            ttsChunksGenerated += e.count ?? 0;
            break;
          case "tts_chunks_played":
            ttsChunksPlayed += e.count ?? 0;
            break;
          case "tts_failure":
            ttsFailures += countOf(e);
            break;
          case "playback_failure":
            playbackFailures += countOf(e);
            break;
          default:
            break;
        }
      }

      // Prefer dedicated generation events over the legacy alias when both exist.
      const genOnly = events
        .filter((e) => e.kind === "tts_generation_latency_ms")
        .map((e) => e.valueMs)
        .filter((v): v is number => v != null);
      const aliasOnly = events
        .filter((e) => e.kind === "tts_latency_ms")
        .map((e) => e.valueMs)
        .filter((v): v is number => v != null);
      const avgTtsSource = genOnly.length > 0 ? genOnly : aliasOnly;
      const legacyPlayback = events
        .filter((e) => e.kind === "playback_duration_ms")
        .map((e) => e.valueMs)
        .filter((v): v is number => v != null);
      const playbackSource =
        playback.length > 0 ? playback : legacyPlayback;

      return {
        turns,
        bargeIns,
        errors,
        retries,
        pauses,
        avgSpeechMs: avgOf(speech),
        avgSttMs: avgOf(stt),
        avgGptMs: avgOf(gpt),
        avgTtsMs: avgOf(avgTtsSource),
        avgTimeToFirstAudioMs: avgOf(firstAudio),
        avgPlaybackMs: avgOf(playbackSource),
        avgMicReopenMs: avgOf(micReopen),
        endpointPauses,
        endpointResumes,
        avgEndpointCommitSilenceMs: avgOf(endpointSilence),
        endpointMaxSilenceCommits,
        speculativeSttReused,
        avgBargeInDetectMs: avgOf(bargeDetect),
        avgBargeInStopMs: avgOf(bargeStop),
        floorYields,
        heldRepliesPlayed,
        staleResultsDiscarded,
        ttsChunksGenerated,
        ttsChunksPlayed,
        ttsFailures,
        playbackFailures,
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
        avgTimeToFirstAudioMs: full.avgTimeToFirstAudioMs,
        avgPlaybackMs: full.avgPlaybackMs,
        avgMicReopenMs: full.avgMicReopenMs,
        endpointPauses: full.endpointPauses,
        endpointResumes: full.endpointResumes,
        avgEndpointCommitSilenceMs: full.avgEndpointCommitSilenceMs,
        endpointMaxSilenceCommits: full.endpointMaxSilenceCommits,
        speculativeSttReused: full.speculativeSttReused,
        avgBargeInDetectMs: full.avgBargeInDetectMs,
        avgBargeInStopMs: full.avgBargeInStopMs,
        floorYields: full.floorYields,
        heldRepliesPlayed: full.heldRepliesPlayed,
        staleResultsDiscarded: full.staleResultsDiscarded,
        ttsChunksGenerated: full.ttsChunksGenerated,
        ttsChunksPlayed: full.ttsChunksPlayed,
        ttsFailures: full.ttsFailures,
        playbackFailures: full.playbackFailures,
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

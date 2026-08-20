import type { SegmentBoundary } from "@/lib/voice/speech-text/types";
import type { SessionSpeechLocale } from "@/lib/voice/config";

/**
 * Timing marks for one therapist→patient turn.
 *
 * Names match the QA brief so a captured turn can be read against it directly.
 * Every mark is optional: a turn can be interrupted, fall back to browser
 * speech, or fail at any stage, and a partial trace is still worth reading.
 */
export type VoiceQaStage =
  /** T0 — therapist speech ended (recorder stopped). */
  | "speech_ended"
  /** T1 — final STT transcript available. */
  | "stt_final"
  /** T2 — conversation request started. */
  | "llm_request"
  /** T3 — model response received. */
  | "llm_response"
  /** T4 — speech-text preparation completed. */
  | "speech_text_ready"
  /** T5 — first TTS request started. */
  | "tts_request"
  /** T6 — first TTS audio available. */
  | "tts_first_audio"
  /** T7 — playback started. */
  | "playback_start";

export type VoiceQaMarks = Partial<Record<VoiceQaStage, number>>;

/** Derived latencies, in milliseconds. `null` where a mark is missing. */
export type VoiceQaLatency = {
  sttMs: number | null;
  llmMs: number | null;
  speechTextMs: number | null;
  /** Scripted "thinking" pause — NOT provider latency. Reported separately so
   *  it is never mistaken for a slow TTS response. */
  thinkingPauseMs: number | null;
  ttsFirstAudioMs: number | null;
  playbackStartMs: number | null;
  /** T7 − T0. */
  totalMs: number | null;
};

/** One synthesized segment plus the metadata the TTS route reported for it. */
export type VoiceQaSegment = {
  index: number;
  text: string;
  boundary: SegmentBoundary;
  /** Scripted pause inserted AFTER this segment. */
  pauseAfterMs: number;
  /** Actual audio the application played. Absent on browser fallback. */
  blob: Blob | null;
  byteLength: number | null;
  /** Decoded duration in seconds, when the browser could measure it. */
  durationSec: number | null;
  /** Wall time for this segment's synthesis request. */
  synthesisMs: number | null;
  provider: string;
  voiceId: string | null;
  model: string | null;
  voiceProfileId: string | null;
  voiceSource: string | null;
  emotion: string | null;
  cached: boolean | null;
};

export type VoiceQaOutcome =
  | "spoken"
  | "browser_fallback"
  | "interrupted"
  | "failed";

/** A complete QA record for one patient response. */
export type VoiceQaTurn = {
  id: string;
  startedAt: string;
  locale: SessionSpeechLocale;
  /** Therapist transcript that produced this response. */
  therapistText: string | null;
  /** Model output, verbatim — the clinical source of truth. */
  displayText: string | null;
  /** What was actually sent to the provider. */
  speechText: string | null;
  /** True when normalization changed anything at all. */
  speechChanged: boolean | null;
  segments: VoiceQaSegment[];
  marks: VoiceQaMarks;
  latency: VoiceQaLatency;
  outcome: VoiceQaOutcome | null;
};

/**
 * Write-side handle threaded through the voice pipeline.
 *
 * The pipeline only ever calls these methods; it never reads QA state, so a
 * missing sink (the production path) removes the feature entirely rather than
 * disabling it. Every method must be safe to call out of order or twice.
 */
export type VoiceQaSink = {
  mark: (stage: VoiceQaStage) => void;
  setTherapistText: (text: string) => void;
  setSpeech: (speech: {
    displayText: string;
    speechText: string;
    changed: boolean;
    locale: SessionSpeechLocale;
    segments: Array<{
      index: number;
      text: string;
      boundary: SegmentBoundary;
      pauseAfterMs: number;
    }>;
  }) => void;
  setThinkingPauseMs: (ms: number) => void;
  captureSegmentAudio: (capture: {
    index: number;
    blob: Blob | null;
    headers: Headers | null;
    synthesisMs: number;
  }) => void;
  finish: (outcome: VoiceQaOutcome) => void;
};

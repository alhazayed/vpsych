/**
 * Voice turn diagnostics — deterministic per-stage state for one voice turn.
 *
 * Every voice turn must end in one of three visible outcomes:
 *   SUCCESS  transcript + patient text + patient audio
 *   PARTIAL  transcript + patient text + explicit "patient audio unavailable"
 *   ERROR    explicit message naming the stage that failed
 *
 * This module is pure (no React, no DOM) so the stage reducer and the
 * user-facing error wording are unit-tested. `voiceLog` emits
 * `[VOICE][STT]` / `[VOICE][TTS]` console lines only when voice debugging is
 * enabled; it never logs transcript text, patient text, audio, or keys.
 */

export const VOICE_STAGES = [
  "mic",
  "recording",
  "stt",
  "transcript",
  "message",
  "patientText",
  "tts",
  "audio",
] as const;

export type VoiceStage = (typeof VOICE_STAGES)[number];

export type VoiceStageStatus = "idle" | "active" | "ok" | "fail" | "skipped";

export type VoiceTurnError = {
  stage: VoiceStage;
  /** Safe, user-facing explanation (no provider payloads, no secrets). */
  message: string;
  /** Machine code from the API (e.g. OPENAI_QUOTA_EXHAUSTED). */
  code?: string;
  /** HTTP status when the failure came from an API route. */
  status?: number;
};

export type VoiceTurnDiagnostics = {
  turn: number;
  stages: Record<VoiceStage, VoiceStageStatus>;
  /** Hard failure: the turn stopped at this stage. */
  error: VoiceTurnError | null;
  /** Soft failure: text is fine but patient audio could not be played. */
  audioUnavailable: VoiceTurnError | null;
  /** Audio played, but only through the browser's fallback voice. */
  audioDegraded: VoiceTurnError | null;
  /** Safe numeric/shape facts (sizes, statuses, lengths) for the debug panel. */
  facts: Record<string, string | number | boolean>;
};

function idleStages(): Record<VoiceStage, VoiceStageStatus> {
  return {
    mic: "idle",
    recording: "idle",
    stt: "idle",
    transcript: "idle",
    message: "idle",
    patientText: "idle",
    tts: "idle",
    audio: "idle",
  };
}

export function initialVoiceDiagnostics(turn = 0): VoiceTurnDiagnostics {
  return {
    turn,
    stages: idleStages(),
    error: null,
    audioUnavailable: null,
    audioDegraded: null,
    facts: {},
  };
}

/** Start a new turn; the microphone stays marked ok if it already was. */
export function beginVoiceTurn(
  prev: VoiceTurnDiagnostics,
): VoiceTurnDiagnostics {
  const next = initialVoiceDiagnostics(prev.turn + 1);
  if (prev.stages.mic === "ok") next.stages.mic = "ok";
  return next;
}

export function markVoiceStage(
  prev: VoiceTurnDiagnostics,
  stage: VoiceStage,
  status: VoiceStageStatus,
  facts?: Record<string, string | number | boolean | undefined>,
): VoiceTurnDiagnostics {
  const merged = { ...prev.facts };
  if (facts) {
    for (const [k, v] of Object.entries(facts)) {
      if (v !== undefined) merged[k] = v;
    }
  }
  return {
    ...prev,
    stages: { ...prev.stages, [stage]: status },
    facts: merged,
  };
}

export function failVoiceStage(
  prev: VoiceTurnDiagnostics,
  error: VoiceTurnError,
): VoiceTurnDiagnostics {
  return {
    ...markVoiceStage(prev, error.stage, "fail"),
    error,
  };
}

export function markAudioUnavailable(
  prev: VoiceTurnDiagnostics,
  error: VoiceTurnError,
): VoiceTurnDiagnostics {
  return {
    ...markVoiceStage(prev, error.stage, "fail"),
    audioUnavailable: error,
  };
}

/** SUCCESS / PARTIAL / ERROR / IN_PROGRESS for one turn. */
export function voiceTurnOutcome(
  d: VoiceTurnDiagnostics,
): "success" | "partial" | "error" | "in_progress" {
  if (d.error) return "error";
  if (d.audioUnavailable && d.stages.patientText === "ok") return "partial";
  if (
    d.stages.transcript === "ok" &&
    d.stages.patientText === "ok" &&
    (d.stages.audio === "ok" || d.stages.audio === "skipped")
  ) {
    return "success";
  }
  return "in_progress";
}

const STAGE_LABEL: Record<VoiceStage, string> = {
  mic: "Microphone",
  recording: "Recording",
  stt: "Speech-to-text",
  transcript: "Transcript",
  message: "Patient reply",
  patientText: "Patient text",
  tts: "Patient voice (TTS)",
  audio: "Patient audio playback",
};

export function voiceStageLabel(stage: VoiceStage): string {
  return STAGE_LABEL[stage];
}

/** Known provider codes mapped to a plain-language cause. */
const CODE_EXPLANATION: Record<string, string> = {
  OPENAI_QUOTA_EXHAUSTED: "OpenAI quota or credit balance is exhausted",
  OPENAI_RATE_LIMIT: "OpenAI rate limit reached",
  OPENAI_AUTH: "OpenAI rejected the API key",
  OPENAI_TIMEOUT: "OpenAI timed out",
  STT_UNAVAILABLE: "speech-to-text is not configured on the server",
  NO_AUDIO: "the recording was empty",
  EMPTY_RECORDING: "the recording was empty",
  AUDIO_TOO_LARGE: "the recording was too large",
  AUDIO_TYPE: "the recording format was not accepted",
  NO_SPEECH: "no speech was detected",
  TTS_UNAVAILABLE: "ElevenLabs is not configured on the server",
  TTS_CONFIG: "the ElevenLabs API key on the server is misconfigured",
  TTS_BAD_CONTENT: "the voice service returned no playable audio",
  TTS_FAILED: "the ElevenLabs voice service returned an error",
  TTS_AUTH: "ElevenLabs rejected the server's API key (ELEVENLABS_API_KEY)",
  TTS_QUOTA: "the ElevenLabs character quota is used up",
  TTS_PLAN_REQUIRED: "this ElevenLabs voice needs a paid plan",
  VOICE_LANGUAGE_UNAVAILABLE:
    "no approved ElevenLabs voice is configured for this language",
  AUTOPLAY_BLOCKED: "the browser blocked audio playback until you click",
  AUDIO_PLAY_FAILED: "the browser could not start audio playback",
  AUDIO_DECODE: "the browser could not decode the patient audio",
  AUDIO_STALLED: "the patient audio stopped advancing in the browser",
  BROWSER_SPEECH_FAILED: "browser speech synthesis also failed",
  BROWSER_SPEECH_UNSUPPORTED: "this browser has no speech synthesis",
  NETWORK: "the network request failed",
  RATE_LIMITED: "too many requests in the last hour",
};

/**
 * One safe sentence for the visible error line, e.g.
 * "Speech-to-text failed (HTTP 429): OpenAI quota or credit balance is exhausted."
 */
export function describeVoiceError(input: {
  stage: VoiceStage;
  status?: number;
  code?: string;
  message?: string;
}): string {
  const label = STAGE_LABEL[input.stage];
  const httpPart =
    typeof input.status === "number" && input.status > 0
      ? ` (HTTP ${input.status})`
      : "";
  const cause =
    (input.code && CODE_EXPLANATION[input.code]) ||
    (input.status === 429 ? CODE_EXPLANATION.RATE_LIMITED : undefined) ||
    (input.status === 401 ? "you are signed out" : undefined) ||
    input.message?.trim() ||
    "unknown error";
  return `${label} failed${httpPart}: ${cause}.`;
}

const PLAYBACK_CODES = new Set([
  "AUTOPLAY_BLOCKED",
  "AUDIO_PLAY_FAILED",
  "AUDIO_DECODE",
  "AUDIO_STALLED",
]);

/**
 * Message for PARTIAL turns: names whether ElevenLabs (TTS) or the browser's
 * playback failed, and that the browser speech fallback failed too.
 */
export function describeAudioUnavailable(input: {
  code: string;
  status?: number;
}): { stage: VoiceStage; message: string } {
  const stage: VoiceStage = PLAYBACK_CODES.has(input.code) ? "audio" : "tts";
  return {
    stage,
    message: `${describeVoiceError({ stage, code: input.code, status: input.status })} Browser speech fallback also failed.`,
  };
}

/** True when the voice debug panel and `[VOICE]` console lines are enabled. */
export function isVoiceDebugEnabled(search?: string | null): boolean {
  if (process.env.NEXT_PUBLIC_VOICE_DEBUG === "true") return true;
  if (process.env.NODE_ENV !== "production") return true;
  const query =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  return /(?:^|[?&])voiceDebug=1(?:&|$)/.test(query ?? "");
}

export type VoiceLogScope = "STT" | "TTS" | "TURN" | "MIC";

/**
 * `[VOICE][STT] stt_request_started { blob_size: 31244 }` — dev / ?voiceDebug=1
 * only. Callers must pass sizes, statuses, and lengths, never content.
 */
export function voiceLog(
  scope: VoiceLogScope,
  event: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!isVoiceDebugEnabled()) return;
  if (detail) console.info(`[VOICE][${scope}] ${event}`, detail);
  else console.info(`[VOICE][${scope}] ${event}`);
}

/** WAV duration in ms from a 16-bit mono PCM blob size (44-byte header). */
export function wavDurationMs(byteSize: number, sampleRate = 16000): number {
  const pcm = Math.max(0, byteSize - 44);
  return Math.round((pcm / 2 / sampleRate) * 1000);
}

/** A WAV with only a header (or under ~50 ms of audio) is an empty recording. */
export function isEmptyRecording(blob: { size: number; type?: string }): boolean {
  if (blob.size <= 0) return true;
  const type = (blob.type || "").toLowerCase();
  if (type.includes("wav")) return wavDurationMs(blob.size) < 50;
  return blob.size < 200;
}

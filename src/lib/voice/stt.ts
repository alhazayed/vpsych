import {
  azureSpeechLocale,
  normalizeSpeechLocale,
  type SessionSpeechLocale,
} from "@/lib/voice/config";

/** Map session.language / locale form field to OpenAI ISO-639-1. */
export function openAISpeechLanguage(
  input?: string | null,
): "en" | "ar" {
  return normalizeSpeechLocale(input);
}

/** BCP-47 tag used in API responses / browser hints. */
export function speechLocaleTag(locale: SessionSpeechLocale): string {
  return azureSpeechLocale(locale);
}

export type TranscribeSuccess = {
  transcript: string;
  provider: "openai";
  model: string;
  locale: string;
  language: "en" | "ar";
};

export type TranscribeFailure = {
  error: string;
  code: string;
  status: number;
};

/** Max STT upload size (10 MiB). OpenAI allows more; we keep turns bounded. */
export const MAX_STT_AUDIO_BYTES = 10 * 1024 * 1024;

export function emptyAudioError(): TranscribeFailure {
  return {
    error: "No audio provided.",
    code: "NO_AUDIO",
    status: 400,
  };
}

export function audioTooLargeError(): TranscribeFailure {
  return {
    error: "Audio too large.",
    code: "AUDIO_TOO_LARGE",
    status: 413,
  };
}

export function audioTypeNotAllowedError(): TranscribeFailure {
  return {
    error: "Unsupported audio type.",
    code: "AUDIO_TYPE",
    status: 415,
  };
}

export function isAllowedSttMime(mimeType: string): boolean {
  const type = (mimeType || "").toLowerCase().trim().split(";")[0] ?? "";
  if (!type) return true; // some browsers omit type; size check still applies
  if (type.startsWith("audio/")) return true;
  // Chrome MediaRecorder often emits video/webm for microphone captures
  if (type.startsWith("video/webm")) return true;
  return false;
}

export function notConfiguredError(): TranscribeFailure {
  return {
    error:
      "OpenAI Speech-to-Text is not configured. Set OPENAI_API_KEY.",
    code: "STT_UNAVAILABLE",
    status: 501,
  };
}

export function guessAudioExtension(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return "wav";
}

/**
 * Build multipart fields for POST /api/voice/transcribe.
 * Preserves the existing Voice Session contract: `audio` + `locale`.
 */
export function buildTranscribeFormData(params: {
  audio: Blob;
  locale: string;
  filename?: string;
}): FormData {
  const form = new FormData();
  const ext = guessAudioExtension(params.audio.type || "audio/wav");
  form.append("audio", params.audio, params.filename ?? `turn.${ext}`);
  form.append("locale", params.locale);
  return form;
}

export function parseTranscribeResponse(data: unknown): {
  transcript: string;
  provider?: string;
  error?: string;
  code?: string;
} {
  if (!data || typeof data !== "object") {
    return { transcript: "" };
  }
  const record = data as Record<string, unknown>;
  return {
    transcript:
      typeof record.transcript === "string" ? record.transcript.trim() : "",
    provider: typeof record.provider === "string" ? record.provider : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
}

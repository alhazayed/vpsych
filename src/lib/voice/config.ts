/** Shared voice locale + provider defaults for STT/TTS. */

// Runtime-one-directional: this module imports values from voice-language,
// which imports only the SessionSpeechLocale *type* back (erased at runtime),
// so there is no require cycle.
import {
  VoiceLanguageError,
  isVoiceApprovedFor,
} from "@/lib/voice/voice-language";

export type SessionSpeechLocale = "en" | "ar";

// Premade voices verified to work on the current ElevenLabs API key.
// Many classic defaults (Rachel, Charlotte, Sam) now return paid_plan_required.
export const DEFAULT_ELEVENLABS_VOICE_EN = "EXAVITQu4vr4xnSDxMaL"; // Bella
export const DEFAULT_ELEVENLABS_VOICE_AR = "pNInz6obpgDQGcFmaJgB"; // Adam (multilingual)

export function normalizeSpeechLocale(
  input?: string | null,
): SessionSpeechLocale {
  if (!input) return "en";
  const v = input.trim().toLowerCase();
  if (v === "ar" || v.startsWith("ar-") || v === "ar_jo" || v === "arabic") {
    return "ar";
  }
  return "en";
}

export function azureSpeechLocale(locale: SessionSpeechLocale): string {
  return locale === "ar" ? "ar-JO" : "en-US";
}

export function browserSpeechLocale(locale: SessionSpeechLocale): string {
  return locale === "ar" ? "ar-SA" : "en-US";
}

/**
 * ElevenLabs voice ids are opaque alphanumeric tokens. Validate before a value
 * is ever interpolated into the upstream request path
 * (`/v1/text-to-speech/${voiceId}/stream`) so a client-supplied id cannot
 * inject path segments (`/`, `..`) and reach other ElevenLabs endpoints, or
 * select an arbitrary off-catalogue voice.
 */
export function isValidElevenLabsVoiceId(
  value: string | null | undefined,
): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(value);
}

/**
 * Resolve the voice id for a locale.
 *
 * Two independent gates apply to every candidate, in order:
 *  1. `isValidElevenLabsVoiceId` — format, so a malformed or path-injecting id
 *     can never reach the upstream request URL.
 *  2. `isVoiceApprovedFor` — language, so a voice verified as English can never
 *     be spoken on an Arabic turn (or vice versa) no matter which slot holds
 *     it. The slot says which language is *wanted*; only this says which
 *     language the voice actually *is*.
 *
 * Candidates are tried in precedence order and a rejected candidate is skipped
 * rather than ending resolution, so a bad legacy column still falls through to
 * a valid same-language default. If no candidate survives both gates the
 * function throws `VoiceLanguageError` — it never returns a voice of the wrong
 * language.
 */
export function resolveElevenLabsVoiceId(params: {
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
}): string {
  // The env override and the built-in default are separate candidates rather
  // than `env || default`. If an operator sets ELEVENLABS_VOICE_ID_EN to a
  // voice of the wrong language, that override is skipped and resolution still
  // reaches the valid built-in default — a same-language fallback, which is
  // safer than failing the turn outright.
  const candidates =
    params.locale === "ar"
      ? [
          params.voiceIdAr,
          process.env.ELEVENLABS_VOICE_ID_AR,
          DEFAULT_ELEVENLABS_VOICE_AR,
        ]
      : [
          params.voiceId,
          process.env.ELEVENLABS_VOICE_ID_EN,
          DEFAULT_ELEVENLABS_VOICE_EN,
        ];

  for (const candidate of candidates) {
    if (!isValidElevenLabsVoiceId(candidate)) continue;
    if (!isVoiceApprovedFor(candidate, params.locale)) continue;
    return candidate;
  }

  throw new VoiceLanguageError(params.locale);
}

export function previewSampleText(locale: SessionSpeechLocale): string {
  return locale === "ar"
    ? "مرحبا، أنا المريضة الافتراضية. هذا معاينة للصوت العربي."
    : "Hello, I am the virtual patient. This is an English voice preview.";
}

export function hasAzureSpeech(): boolean {
  return Boolean(
    process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION,
  );
}

export function hasElevenLabs(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** Shared voice locale + provider defaults for STT/TTS. */

import { isElevenLabsVoiceId } from "@/lib/voice/tts/voice-format";

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
 *
 * Delegates to the provider-aware validator so a Google voice name
 * (`ar-XA-Chirp3-HD-Kore`) can never be resolved as an ElevenLabs id.
 */
export function isValidElevenLabsVoiceId(
  value: string | null | undefined,
): value is string {
  return isElevenLabsVoiceId(value);
}

export function resolveElevenLabsVoiceId(params: {
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
}): string {
  const envEn =
    process.env.ELEVENLABS_VOICE_ID_EN || DEFAULT_ELEVENLABS_VOICE_EN;
  const envAr =
    process.env.ELEVENLABS_VOICE_ID_AR || DEFAULT_ELEVENLABS_VOICE_AR;

  // Invalid (or path-injecting) ids are ignored and fall back to the safe
  // configured default rather than being passed through to the upstream URL.
  if (params.locale === "ar") {
    return isValidElevenLabsVoiceId(params.voiceIdAr) ? params.voiceIdAr : envAr;
  }
  return isValidElevenLabsVoiceId(params.voiceId) ? params.voiceId : envEn;
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

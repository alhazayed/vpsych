/** Shared voice locale + provider defaults for STT/TTS. */

export type SessionSpeechLocale = "en" | "ar";

// Premade voices verified to work on typical ElevenLabs API plans.
// Chosen for standardized-patient naturalness (see voice-comparison.ts).
// Many classic library defaults still return paid_plan_required on free keys.
export const DEFAULT_ELEVENLABS_VOICE_EN = "EXAVITQu4vr4xnSDxMaL"; // Sarah — warm adult female SP
export const DEFAULT_ELEVENLABS_VOICE_AR = "XB0fDUnXU5powFXDhCwa"; // Charlotte — multilingual AR+EN

/** Best quality multilingual model for psychiatric SP (emotion + EN/AR). */
export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

/**
 * High-quality MP3 for browser playback. Avoid ultra-low-latency / telephony
 * formats that sound thin or robotic in a consultation room.
 */
export const DEFAULT_ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

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

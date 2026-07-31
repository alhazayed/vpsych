/** Shared voice locale + provider defaults for STT/TTS. */

export type SessionSpeechLocale = "en" | "ar";

export const DEFAULT_ELEVENLABS_VOICE_EN = "21m00Tcm4TlvDq8ikWAM"; // Rachel
export const DEFAULT_ELEVENLABS_VOICE_AR = "XB0fDUnXU5powFXDhCwa"; // Charlotte (multilingual)

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

export function resolveElevenLabsVoiceId(params: {
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
}): string {
  const envEn =
    process.env.ELEVENLABS_VOICE_ID_EN || DEFAULT_ELEVENLABS_VOICE_EN;
  const envAr =
    process.env.ELEVENLABS_VOICE_ID_AR || DEFAULT_ELEVENLABS_VOICE_AR;

  if (params.locale === "ar") {
    return params.voiceIdAr || envAr;
  }
  return params.voiceId || envEn;
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

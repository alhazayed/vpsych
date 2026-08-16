/**
 * Google Cloud Text-to-Speech configuration.
 *
 * Benchmark stage: Chirp 3 HD, `ar-XA` for Arabic, MP3 output, REST only.
 * No production clinical voice is hard-coded here — the defaults below are
 * explicitly temporary benchmark voices and are meant to be overridden by
 * `GOOGLE_TTS_VOICE_EN` / `GOOGLE_TTS_VOICE_AR` once voice casting is decided.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";
import { isGoogleVoiceName } from "@/lib/voice/tts/voice-format";

/** Documented REST surface: POST {base}/v1/text:synthesize */
export const GOOGLE_TTS_ENDPOINT =
  "https://texttospeech.googleapis.com/v1/text:synthesize";

/**
 * Temporary benchmark voices — Chirp 3 HD, chosen only to validate the
 * transport end to end. `Kore` is a Chirp 3 HD voice available across the
 * Chirp 3 locale set; Arabic uses the generic `ar-XA` locale because Google
 * publishes no `ar-JO` voice. See the Arabic limitation notes in the
 * implementation report before casting a production patient voice.
 */
export const BENCHMARK_GOOGLE_VOICE_EN = "en-US-Chirp3-HD-Kore";
export const BENCHMARK_GOOGLE_VOICE_AR = "ar-XA-Chirp3-HD-Kore";

export const DEFAULT_GOOGLE_LANGUAGE_EN = "en-US";
/** Google has no ar-JO; ar-XA is the only Arabic locale offered. */
export const DEFAULT_GOOGLE_LANGUAGE_AR = "ar-XA";

/** Google rejects a SynthesisInput larger than 5000 bytes. */
export const GOOGLE_TTS_MAX_INPUT_BYTES = 5000;

const DEFAULT_TIMEOUT_MS = 30_000;

export function googleTtsTimeoutMs(): number {
  const raw = process.env.GOOGLE_TTS_TIMEOUT_MS ?? process.env.TTS_TIMEOUT_MS;
  const n = Number(raw ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function envValue(key: string): string {
  // Strip wrapping quotes from dashboard paste errors.
  const raw = process.env[key]?.trim() || "";
  return raw.replace(/^['"]+|['"]+$/g, "").trim();
}

/** API key credential (sent as `X-Goog-Api-Key`). Server-side only. */
export function googleApiKey(): string {
  return envValue("GOOGLE_TTS_API_KEY");
}

/**
 * Pre-minted OAuth access token (sent as `Authorization: Bearer`).
 * For deployments where the platform supplies a token out of band.
 */
export function googleAccessToken(): string {
  return envValue("GOOGLE_TTS_ACCESS_TOKEN");
}

export function hasGoogleTts(): boolean {
  return Boolean(googleApiKey() || googleAccessToken());
}

/**
 * Credential headers for the REST call.
 *
 * Both mechanisms are documented for `texttospeech.googleapis.com` REST:
 * an API key via `X-Goog-Api-Key`, or an OAuth 2.0 access token minted for the
 * `https://www.googleapis.com/auth/cloud-platform` scope via `Authorization:
 * Bearer`. Credentials are read from server-only env vars and never reach the
 * browser — the browser talks to `/api/voice/tts`, not to Google.
 *
 * A service-account JWT minter can be added behind this one function without
 * touching the transport; see the implementation report.
 */
export function googleAuthHeaders(): Record<string, string> {
  const token = googleAccessToken();
  if (token) return { Authorization: `Bearer ${token}` };
  const key = googleApiKey();
  if (key) return { "X-Goog-Api-Key": key };
  return {};
}

export function googleLanguageCode(locale: SessionSpeechLocale): string {
  const configured =
    locale === "ar"
      ? envValue("GOOGLE_TTS_LANGUAGE_AR")
      : envValue("GOOGLE_TTS_LANGUAGE_EN");
  if (configured) return configured;
  return locale === "ar"
    ? DEFAULT_GOOGLE_LANGUAGE_AR
    : DEFAULT_GOOGLE_LANGUAGE_EN;
}

/** Configured (or benchmark) default voice for a locale. */
export function googleDefaultVoice(locale: SessionSpeechLocale): string {
  const configured =
    locale === "ar"
      ? envValue("GOOGLE_TTS_VOICE_AR")
      : envValue("GOOGLE_TTS_VOICE_EN");
  if (isGoogleVoiceName(configured)) return configured;
  return locale === "ar"
    ? BENCHMARK_GOOGLE_VOICE_AR
    : BENCHMARK_GOOGLE_VOICE_EN;
}

/**
 * Resolve the Google voice name to synthesize with.
 * Malformed or non-Google values fall back to the configured default rather
 * than being forwarded upstream.
 */
export function resolveGoogleVoiceName(params: {
  locale: SessionSpeechLocale;
  voiceId?: string | null;
  voiceIdAr?: string | null;
}): string {
  const candidate = params.locale === "ar" ? params.voiceIdAr : params.voiceId;
  if (isGoogleVoiceName(candidate)) return candidate;
  return googleDefaultVoice(params.locale);
}

/**
 * Model identifier reported back as `X-Voice-Model`, derived from the voice
 * name (`ar-XA-Chirp3-HD-Kore` → `chirp3-hd`).
 */
export function googleModelIdFromVoice(voiceName: string): string {
  const parts = voiceName.split("-");
  // <lang>-<REGION>-<model…>-<variant>
  if (parts.length >= 4) {
    return parts.slice(2, parts.length - 1).join("-").toLowerCase();
  }
  return "google-tts";
}

function envFlag(key: string): boolean {
  return envValue(key).toLowerCase() === "true";
}

/**
 * Pace control. Google documents Chirp 3 HD `speaking_rate` [0.25, 2.0] across
 * all locales, so this flag is a ROLLOUT control, not a compatibility
 * workaround: production stays conservative until the benchmark signs it off,
 * while `GOOGLE_TTS_ENABLE_SPEAKING_RATE=true` exercises the real feature.
 */
export function googleSpeakingRateEnabled(): boolean {
  return envFlag("GOOGLE_TTS_ENABLE_SPEAKING_RATE");
}

/**
 * Pause control via the Chirp 3 HD `markup` input field.
 * Off by default: field reports contradict the documented locale coverage and
 * describe garbled output when markup is used, so this must be benchmarked
 * per voice before it is trusted with clinical dialogue.
 */
export function googlePauseControlEnabled(): boolean {
  return envFlag("GOOGLE_TTS_ENABLE_PAUSE_CONTROL");
}

/**
 * Custom pronunciations (IPA / X-SAMPA). Off by default: the shipped
 * dictionary is an unreviewed benchmark placeholder, not clinical content.
 */
export function googleCustomPronunciationEnabled(): boolean {
  return envFlag("GOOGLE_TTS_ENABLE_CUSTOM_PRONUNCIATION");
}

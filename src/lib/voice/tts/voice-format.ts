/**
 * Provider-aware voice identifier validation.
 *
 * Two separate jobs, both load-bearing:
 *
 * 1. **Injection defense.** A voice identifier is interpolated into an upstream
 *    request (ElevenLabs puts it in the URL path). Malformed values must never
 *    reach the provider.
 * 2. **Provider isolation.** An ElevenLabs voice id must never be sent to
 *    Google, and a Google voice name must never be sent to ElevenLabs. Sending
 *    the wrong shape wastes a provider call and, worse, would let a stale
 *    avatar/profile row silently mis-cast a patient onto whatever the wrong
 *    provider treats as a default.
 *
 * This module does NOT decide whether a voice is *authorized* — that remains
 * `resolveTtsVoice`'s allowlist check against voice_profiles / avatars.
 */

import type { TtsProviderId } from "@/lib/voice/tts/types";

/**
 * ElevenLabs voice ids are opaque alphanumeric tokens (e.g. `EXAVITQu4vr4xnSDxMaL`).
 */
const ELEVENLABS_VOICE_ID = /^[A-Za-z0-9_-]{3,64}$/;

/**
 * Google voice names are `<languageCode>-<model>-<variant…>`, e.g.
 * `ar-XA-Chirp3-HD-Kore`, `en-US-Chirp3-HD-Kore`, `en-US-Neural2-A`.
 * The language code is 2–3 lowercase letters plus an uppercase region.
 */
const GOOGLE_VOICE_NAME =
  /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

export function isGoogleVoiceName(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    GOOGLE_VOICE_NAME.test(value)
  );
}

/**
 * ElevenLabs shape. Google names also satisfy the raw character class, so they
 * are explicitly excluded — that exclusion is the provider-isolation half.
 */
export function isElevenLabsVoiceId(
  value: string | null | undefined,
): value is string {
  return (
    typeof value === "string" &&
    ELEVENLABS_VOICE_ID.test(value) &&
    !isGoogleVoiceName(value)
  );
}

/** True when `voiceId` is well-formed *for this specific provider*. */
export function isVoiceIdForProvider(
  provider: TtsProviderId,
  voiceId: string | null | undefined,
): voiceId is string {
  return provider === "google"
    ? isGoogleVoiceName(voiceId)
    : isElevenLabsVoiceId(voiceId);
}

/**
 * Best-effort provider inference from a voice identifier's shape.
 * Used to filter legacy `avatars.voice_id` columns, which carry no provider
 * column of their own.
 */
export function providerForVoiceId(
  voiceId: string | null | undefined,
): TtsProviderId | null {
  if (isGoogleVoiceName(voiceId)) return "google";
  if (isElevenLabsVoiceId(voiceId)) return "elevenlabs";
  return null;
}

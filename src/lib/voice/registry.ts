/**
 * Voice Registry helpers.
 *
 * Resolution path:
 *   Avatar → voice_profile → voice_id → TTS provider
 *
 * Legacy avatars.voice_id / voice_id_ar remain as fallbacks.
 *
 * Provider isolation: resolution is scoped to the active TTS provider. A
 * profile or legacy column belonging to another provider is skipped rather
 * than forwarded, so an ElevenLabs voice id can never be sent to Google and a
 * Google voice name can never be sent to ElevenLabs.
 */

import {
  normalizeSpeechLocale,
  resolveElevenLabsVoiceId,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import { resolveGoogleVoiceName } from "@/lib/voice/google/config";
import { isVoiceIdForProvider } from "@/lib/voice/tts/voice-format";
import type { TtsProviderId } from "@/lib/voice/tts/types";
import type { Avatar, VoiceProfile } from "@/lib/types";

export type VoiceResolution = {
  voiceId: string;
  source: "voice_profile" | "legacy_column" | "env_default";
  voiceProfileId?: string | null;
  provider?: string;
  locale: SessionSpeechLocale;
  /** Mission 3 — full registry row for clinical live-switching (when loaded). */
  clinicalProfile?: VoiceProfile | null;
};

/** Provider default voice for a locale, honoring valid per-provider overrides. */
function providerDefaultVoiceId(
  provider: TtsProviderId,
  params: {
    locale: SessionSpeechLocale;
    voiceId?: string | null;
    voiceIdAr?: string | null;
  },
): string {
  return provider === "google"
    ? resolveGoogleVoiceName(params)
    : resolveElevenLabsVoiceId(params);
}

/** Normalize PostgREST embed shapes (object | array | null). */
export function coerceVoiceProfile(
  value: VoiceProfile | VoiceProfile[] | null | undefined,
): VoiceProfile | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function isActiveVoiceProfile(
  profile: VoiceProfile | null | undefined,
): profile is VoiceProfile {
  return Boolean(profile && profile.is_active && profile.voice_id?.trim());
}

/**
 * Resolve the provider voice identifier for a speaking avatar.
 * Prefer an active assigned voice_profile when its language matches the locale
 * (or when no language-specific legacy column is needed). Otherwise fall back
 * to flat voice_id / voice_id_ar / env defaults for backward compatibility.
 *
 * `provider` defaults to `elevenlabs` so existing callers keep their behavior.
 */
export function resolveAvatarSpeechVoice(params: {
  locale: SessionSpeechLocale | string;
  voiceProfile?: VoiceProfile | null;
  voiceProfileId?: string | null;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  provider?: TtsProviderId;
}): VoiceResolution {
  const locale = normalizeSpeechLocale(params.locale);
  const provider: TtsProviderId = params.provider ?? "elevenlabs";
  const profile = coerceVoiceProfile(params.voiceProfile);

  if (isActiveVoiceProfile(profile)) {
    const profileLocale = normalizeSpeechLocale(profile.language);
    // Only use a registry profile when its language matches the session locale.
    // Cross-locale profiles (e.g. Arabic Amira on an English turn) must not win —
    // that routed EN sessions onto Voice Library ids that free API keys reject.
    //
    // The profile must also belong to the active provider and carry a voice id
    // in that provider's format; otherwise it is skipped, never forwarded.
    const providerMatches =
      profile.provider === provider &&
      isVoiceIdForProvider(provider, profile.voice_id);

    if (profileLocale === locale && providerMatches) {
      return {
        voiceId: profile.voice_id,
        source: "voice_profile",
        voiceProfileId: profile.id,
        provider: profile.provider,
        locale,
        clinicalProfile: profile,
      };
    }
  }

  // Legacy columns carry no provider column, so trust them only when the value
  // is shaped for the active provider.
  const legacyVoiceId = isVoiceIdForProvider(provider, params.voiceId)
    ? params.voiceId
    : null;
  const legacyVoiceIdAr = isVoiceIdForProvider(provider, params.voiceIdAr)
    ? params.voiceIdAr
    : null;

  const resolved = providerDefaultVoiceId(provider, {
    locale,
    voiceId: legacyVoiceId,
    voiceIdAr: legacyVoiceIdAr,
  });

  const usedLegacy =
    (locale === "ar" && Boolean(legacyVoiceIdAr)) ||
    (locale === "en" && Boolean(legacyVoiceId));

  return {
    voiceId: resolved,
    source: usedLegacy ? "legacy_column" : "env_default",
    voiceProfileId: params.voiceProfileId ?? profile?.id ?? null,
    provider,
    locale,
    clinicalProfile: profile,
  };
}

/** Project registry + legacy columns onto ResolvedAvatar voice fields. */
export function projectAvatarVoiceFields(avatar: Avatar): {
  voice_profile_id: string | null;
  voice_profile: VoiceProfile | null;
  voice_id: string | null;
  voice_id_ar: string | null;
} {
  const profile = coerceVoiceProfile(avatar.voice_profile);
  const active = isActiveVoiceProfile(profile) ? profile : null;

  let voiceId = avatar.voice_id ?? null;
  let voiceIdAr = avatar.voice_id_ar ?? null;

  if (active) {
    const lang = normalizeSpeechLocale(active.language);
    if (lang === "ar") {
      voiceIdAr = active.voice_id;
    } else {
      voiceId = active.voice_id;
    }
  }

  return {
    voice_profile_id: avatar.voice_profile_id ?? active?.id ?? null,
    voice_profile: active,
    voice_id: voiceId,
    voice_id_ar: voiceIdAr,
  };
}

/** Sync denormalized legacy columns when assigning a profile (admin). */
export function legacyColumnsFromProfile(profile: VoiceProfile): {
  voice_id?: string | null;
  voice_id_ar?: string | null;
} {
  const lang = normalizeSpeechLocale(profile.language);
  if (lang === "ar") {
    return { voice_id_ar: profile.voice_id };
  }
  return { voice_id: profile.voice_id };
}

/**
 * Clear the legacy column that was synced from a previously assigned profile.
 * Lets TTS fall back to env defaults after admin unassign.
 */
export function clearLegacyColumnsFromProfile(profile: VoiceProfile): {
  voice_id?: string | null;
  voice_id_ar?: string | null;
} {
  const lang = normalizeSpeechLocale(profile.language);
  if (lang === "ar") {
    return { voice_id_ar: null };
  }
  return { voice_id: null };
}

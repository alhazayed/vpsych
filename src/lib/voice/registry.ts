/**
 * ElevenLabs Voice Registry helpers.
 *
 * Resolution path:
 *   Avatar → voice_profile → voice_id → ElevenLabs API
 *
 * Legacy avatars.voice_id / voice_id_ar remain as fallbacks.
 */

import {
  normalizeSpeechLocale,
  resolveElevenLabsVoiceId,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import type { Avatar, VoiceProfile } from "@/lib/types";

export type VoiceResolution = {
  voiceId: string;
  source: "voice_profile" | "legacy_column" | "env_default";
  voiceProfileId?: string | null;
  provider?: string;
  locale: SessionSpeechLocale;
};

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
 * Resolve the ElevenLabs voice_id for a speaking avatar.
 * Prefer an active assigned voice_profile when its language matches the locale
 * (or when no language-specific legacy column is needed). Otherwise fall back
 * to flat voice_id / voice_id_ar / env defaults for backward compatibility.
 */
export function resolveAvatarSpeechVoice(params: {
  locale: SessionSpeechLocale | string;
  voiceProfile?: VoiceProfile | null;
  voiceProfileId?: string | null;
  voiceId?: string | null;
  voiceIdAr?: string | null;
}): VoiceResolution {
  const locale = normalizeSpeechLocale(params.locale);
  const profile = coerceVoiceProfile(params.voiceProfile);

  if (isActiveVoiceProfile(profile)) {
    const profileLocale = normalizeSpeechLocale(profile.language);
    // Use registry voice when it matches the session locale, or when there is
    // no competing legacy id for the other locale (single-profile avatars).
    const legacyForLocale =
      locale === "ar" ? params.voiceIdAr : params.voiceId;
    if (profileLocale === locale || !legacyForLocale) {
      return {
        voiceId: profile.voice_id,
        source: "voice_profile",
        voiceProfileId: profile.id,
        provider: profile.provider,
        locale,
      };
    }
  }

  const resolved = resolveElevenLabsVoiceId({
    locale,
    voiceId: params.voiceId,
    voiceIdAr: params.voiceIdAr,
  });

  const usedLegacy =
    (locale === "ar" && Boolean(params.voiceIdAr)) ||
    (locale === "en" && Boolean(params.voiceId));

  return {
    voiceId: resolved,
    source: usedLegacy ? "legacy_column" : "env_default",
    voiceProfileId: params.voiceProfileId ?? profile?.id ?? null,
    provider: "elevenlabs",
    locale,
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
  voice_id?: string;
  voice_id_ar?: string;
} {
  const lang = normalizeSpeechLocale(profile.language);
  if (lang === "ar") {
    return { voice_id_ar: profile.voice_id };
  }
  return { voice_id: profile.voice_id };
}

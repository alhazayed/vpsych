/**
 * Server-side TTS voice resolution:
 * Avatar (optional) → voice_profile → voice_id → active TTS provider
 * Falls back to explicit voiceId / voiceIdAr for backward compatibility.
 *
 * Security: raw `voiceId` / `voiceIdAr` values are attacker-controlled input
 * (any authenticated user can POST them directly to /api/voice/tts). They are
 * only trusted when they match a voice_id already registered in the app's
 * voice configuration (voice_profiles registry or an avatars row) — never
 * passed straight through to a provider API. This prevents an authenticated
 * but otherwise unprivileged user from directing the server's provider
 * credentials at an arbitrary, unapproved voice (cost/authorization abuse —
 * "unauthorized voice use").
 *
 * The allowlist is provider-scoped: an entry only counts when it belongs to
 * the active provider (by `voice_profiles.provider`, or by identifier shape
 * for the provider-less legacy `avatars` columns) and is well-formed for that
 * provider. A registered ElevenLabs id is therefore still rejected while
 * Google is active, and vice versa.
 */

import { createClient } from "@/lib/supabase/server";
import {
  coerceVoiceProfile,
  resolveAvatarSpeechVoice,
  type VoiceResolution,
} from "@/lib/voice/registry";
import {
  DEFAULT_ELEVENLABS_VOICE_AR,
  DEFAULT_ELEVENLABS_VOICE_EN,
  type SessionSpeechLocale,
} from "@/lib/voice/config";
import { googleDefaultVoice } from "@/lib/voice/google/config";
import { resolveTtsProviderId } from "@/lib/voice/tts/provider";
import { isVoiceIdForProvider } from "@/lib/voice/tts/voice-format";
import type { TtsProviderId } from "@/lib/voice/tts/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceProfile } from "@/lib/types";

/** Provider-configured default voices, which are always allowed. */
function configuredDefaults(provider: TtsProviderId): string[] {
  if (provider === "google") {
    return [googleDefaultVoice("en"), googleDefaultVoice("ar")];
  }
  return [
    process.env.ELEVENLABS_VOICE_ID_EN,
    process.env.ELEVENLABS_VOICE_ID_AR,
    DEFAULT_ELEVENLABS_VOICE_EN,
    DEFAULT_ELEVENLABS_VOICE_AR,
  ].filter((v): v is string => Boolean(v?.trim()));
}

/**
 * Every voice id known to the app for the active provider: the registry rows
 * for that provider, plus any avatar-level ids in that provider's format.
 */
async function loadAllowedVoiceIds(
  supabase: SupabaseClient,
  provider: TtsProviderId,
): Promise<Set<string>> {
  const allowed = new Set<string>();
  for (const id of configuredDefaults(provider)) {
    if (isVoiceIdForProvider(provider, id)) allowed.add(id);
  }

  const [{ data: profiles }, { data: avatars }] = await Promise.all([
    supabase.from("voice_profiles").select("voice_id, provider"),
    supabase.from("avatars").select("voice_id, voice_id_ar"),
  ]);

  for (const row of profiles ?? []) {
    const voiceId = row.voice_id as string | null;
    const rowProvider = (row as { provider?: string | null }).provider;
    // Rows predating the provider column are treated as ElevenLabs, matching
    // the column default in the registry migration.
    const effectiveProvider = rowProvider ?? "elevenlabs";
    if (effectiveProvider !== provider) continue;
    if (isVoiceIdForProvider(provider, voiceId)) allowed.add(voiceId);
  }

  for (const row of avatars ?? []) {
    for (const key of ["voice_id", "voice_id_ar"] as const) {
      const value = (row as Record<string, unknown>)[key] as string | null;
      if (isVoiceIdForProvider(provider, value)) allowed.add(value);
    }
  }

  return allowed;
}

export async function resolveTtsVoice(params: {
  locale: SessionSpeechLocale;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  voiceId?: string | null;
  voiceIdAr?: string | null;
  /** Defaults to the configured provider; injectable for tests. */
  provider?: TtsProviderId;
}): Promise<VoiceResolution> {
  const provider: TtsProviderId = params.provider ?? resolveTtsProviderId();

  let profile: VoiceProfile | null = null;
  let profileId = params.voiceProfileId ?? null;
  let legacyVoiceId = params.voiceId ?? null;
  let legacyVoiceIdAr = params.voiceIdAr ?? null;

  const supabase = await createClient();

  if (params.avatarId) {
    const { data } = await supabase
      .from("avatars")
      .select(
        "voice_profile_id, voice_id, voice_id_ar, voice_profile:voice_profiles(*)",
      )
      .eq("id", params.avatarId)
      .maybeSingle();

    if (data) {
      profileId = profileId ?? (data.voice_profile_id as string | null);
      legacyVoiceId = legacyVoiceId ?? (data.voice_id as string | null);
      legacyVoiceIdAr = legacyVoiceIdAr ?? (data.voice_id_ar as string | null);
      profile = coerceVoiceProfile(
        data.voice_profile as VoiceProfile | VoiceProfile[] | null,
      );
    }
  }

  if (!profile && profileId) {
    const { data } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();
    profile = (data as VoiceProfile | null) ?? null;
  }

  // Reject any voiceId/voiceIdAr that isn't a known, app-configured voice for
  // the active provider before it can reach resolveAvatarSpeechVoice → the
  // provider API call.
  if (legacyVoiceId || legacyVoiceIdAr) {
    const allowed = await loadAllowedVoiceIds(supabase, provider);
    if (legacyVoiceId && !allowed.has(legacyVoiceId)) legacyVoiceId = null;
    if (legacyVoiceIdAr && !allowed.has(legacyVoiceIdAr)) legacyVoiceIdAr = null;
  }

  return resolveAvatarSpeechVoice({
    locale: params.locale,
    voiceProfile: profile,
    voiceProfileId: profileId,
    voiceId: legacyVoiceId,
    voiceIdAr: legacyVoiceIdAr,
    provider,
  });
}

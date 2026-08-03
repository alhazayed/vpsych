/**
 * Server-side TTS voice resolution:
 * Avatar (optional) → voice_profile → voice_id → ElevenLabs
 * Falls back to explicit voiceId / voiceIdAr for backward compatibility.
 *
 * Security: raw `voiceId` / `voiceIdAr` values are attacker-controlled input
 * (any authenticated user can POST them directly to /api/voice/tts). They are
 * only trusted when they match a voice_id already registered in the app's
 * voice configuration (voice_profiles registry or an avatars row) — never
 * passed straight through to the ElevenLabs API. This prevents an
 * authenticated but otherwise unprivileged user from directing the server's
 * ElevenLabs API key at an arbitrary, unapproved voice (cost/authorization
 * abuse — "unauthorized voice use").
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
import type { SupabaseClient } from "@supabase/supabase-js";
import type { VoiceProfile } from "@/lib/types";

/** Every voice_id known to the app: the registry plus any avatar-level ids. */
async function loadAllowedVoiceIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const allowed = new Set<string>(
    [
      process.env.ELEVENLABS_VOICE_ID_EN,
      process.env.ELEVENLABS_VOICE_ID_AR,
      DEFAULT_ELEVENLABS_VOICE_EN,
      DEFAULT_ELEVENLABS_VOICE_AR,
    ].filter((v): v is string => Boolean(v?.trim())),
  );

  const [{ data: profiles }, { data: avatars }] = await Promise.all([
    supabase.from("voice_profiles").select("voice_id"),
    supabase.from("avatars").select("voice_id, voice_id_ar"),
  ]);

  for (const row of profiles ?? []) {
    if (row.voice_id) allowed.add(row.voice_id as string);
  }
  for (const row of avatars ?? []) {
    if (row.voice_id) allowed.add(row.voice_id as string);
    if (row.voice_id_ar) allowed.add(row.voice_id_ar as string);
  }

  return allowed;
}

export async function resolveTtsVoice(params: {
  locale: SessionSpeechLocale;
  voiceProfileId?: string | null;
  avatarId?: string | null;
  voiceId?: string | null;
  voiceIdAr?: string | null;
}): Promise<VoiceResolution> {
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

  // Reject any voiceId/voiceIdAr that isn't a known, app-configured voice
  // before it can reach resolveAvatarSpeechVoice → the ElevenLabs API call.
  if (legacyVoiceId || legacyVoiceIdAr) {
    const allowed = await loadAllowedVoiceIds(supabase);
    if (legacyVoiceId && !allowed.has(legacyVoiceId)) legacyVoiceId = null;
    if (legacyVoiceIdAr && !allowed.has(legacyVoiceIdAr)) legacyVoiceIdAr = null;
  }

  return resolveAvatarSpeechVoice({
    locale: params.locale,
    voiceProfile: profile,
    voiceProfileId: profileId,
    voiceId: legacyVoiceId,
    voiceIdAr: legacyVoiceIdAr,
  });
}

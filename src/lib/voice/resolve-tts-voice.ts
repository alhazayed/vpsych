/**
 * Server-side TTS voice resolution:
 * Avatar (optional) → voice_profile → voice_id → ElevenLabs
 * Falls back to explicit voiceId / voiceIdAr for backward compatibility.
 */

import { createClient } from "@/lib/supabase/server";
import {
  coerceVoiceProfile,
  resolveAvatarSpeechVoice,
  type VoiceResolution,
} from "@/lib/voice/registry";
import type { SessionSpeechLocale } from "@/lib/voice/config";
import type { VoiceProfile } from "@/lib/types";

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

  return resolveAvatarSpeechVoice({
    locale: params.locale,
    voiceProfile: profile,
    voiceProfileId: profileId,
    voiceId: legacyVoiceId,
    voiceIdAr: legacyVoiceIdAr,
  });
}

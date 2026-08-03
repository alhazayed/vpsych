import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { sanitizeDbError } from "@/lib/safe-client-error";
import {
  clearLegacyColumnsFromProfile,
  coerceVoiceProfile,
  legacyColumnsFromProfile,
} from "@/lib/voice/registry";
import type { VoiceProfile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: assign (or clear) a voice_profile on an avatar.
 * Body: { voice_profile_id: string | null }
 * Syncs legacy voice_id / voice_id_ar for backward compatibility.
 * Unassign clears the legacy column synced from the previous profile.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id: avatarId } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.voice.assign",
    resourceType: "avatar",
    resourceId: avatarId,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    voice_profile_id?: string | null;
  };

  if (!("voice_profile_id" in body)) {
    return NextResponse.json(
      { error: "voice_profile_id required (string or null)" },
      { status: 400 },
    );
  }

  const voiceProfileId = body.voice_profile_id;

  let legacyPatch: { voice_id?: string | null; voice_id_ar?: string | null } =
    {};
  if (voiceProfileId) {
    const { data: voice, error: voiceError } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", voiceProfileId)
      .single();

    if (voiceError || !voice) {
      return NextResponse.json(
        { error: "Voice profile not found" },
        { status: 404 },
      );
    }
    if (!(voice as VoiceProfile).is_active) {
      return NextResponse.json(
        { error: "Cannot assign an inactive voice profile" },
        { status: 409 },
      );
    }
    legacyPatch = legacyColumnsFromProfile(voice as VoiceProfile);
  } else {
    const { data: current } = await supabase
      .from("avatars")
      .select("voice_profile_id, voice_profile:voice_profiles(*)")
      .eq("id", avatarId)
      .maybeSingle();
    const previous = coerceVoiceProfile(
      current?.voice_profile as VoiceProfile | VoiceProfile[] | null,
    );
    if (previous) {
      legacyPatch = clearLegacyColumnsFromProfile(previous);
    }
  }

  const { data, error } = await supabase
    .from("avatars")
    .update({
      voice_profile_id: voiceProfileId,
      ...legacyPatch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", avatarId)
    .select(
      "id, name, voice_profile_id, voice_id, voice_id_ar, voice_profile:voice_profiles(*)",
    )
    .single();

  if (error || !data) {
    console.warn("[admin/avatar/voice] assign:", error?.message);
    return NextResponse.json(
      { error: sanitizeDbError(error?.message) },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    action: "admin.avatar.voice.assign",
    outcome: "success",
    resourceType: "avatar",
    resourceId: avatarId,
    metadata: { voice_profile_id: voiceProfileId },
    request,
  });

  return NextResponse.json({ avatar: data });
}

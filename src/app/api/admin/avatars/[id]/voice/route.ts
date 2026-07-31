import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { legacyColumnsFromProfile } from "@/lib/voice/registry";
import type { VoiceProfile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: assign (or clear) a voice_profile on an avatar.
 * Body: { voice_profile_id: string | null }
 * Syncs legacy voice_id / voice_id_ar for backward compatibility.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id: avatarId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  let legacyPatch: { voice_id?: string; voice_id_ar?: string } = {};
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
    return NextResponse.json(
      { error: error?.message ?? "Assign failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ avatar: data });
}

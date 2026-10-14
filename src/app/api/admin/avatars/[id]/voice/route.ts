import { clientSafeError } from "@/lib/api-errors";
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { assertAvatarContentMutable } from "@/lib/admin/virtual-patient/mutability";
import { voiceGenderMismatchAfterUpdate } from "@/lib/admin/virtual-patient";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  clearLegacyColumnsFromProfile,
  coerceVoiceProfile,
  legacyColumnsFromProfile,
} from "@/lib/voice/registry";
import type { Avatar, VoiceProfile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: assign (or clear) a voice_profile on an avatar.
 * Body: { voice_profile_id: string | null }
 * Syncs legacy voice_id / voice_id_ar for backward compatibility.
 * Unassign clears the legacy column synced from the previous profile.
 * Published/archived avatars are immutable (Phase 10C-1).
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

  const mutable = await assertAvatarContentMutable(supabase, avatarId);
  if (!mutable.ok) {
    return NextResponse.json(
      { error: mutable.error },
      { status: mutable.status },
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

    // The voice must match the patient's gender (female voice ⇒ female
    // patient and vice versa).
    const { data: current, error: currentErr } = await supabase
      .from("avatars")
      .select("clinical_core, voice_id, voice_id_ar, voice_profile:voice_profiles(*)")
      .eq("id", avatarId)
      .maybeSingle();
    // Without the current row the gender check cannot run; never skip it.
    if (currentErr) return avatarReadFailed(avatarId, currentErr);
    const mismatch = current
      ? voiceGenderMismatchAfterUpdate(
          current as unknown as Avatar,
          { voice_profile_id: voiceProfileId, ...legacyPatch },
          { voiceProfile: voice as VoiceProfile },
        )
      : null;
    if (mismatch) {
      return NextResponse.json(
        { error: mismatch.error, issues: mismatch.issues },
        { status: 409 },
      );
    }
  } else {
    const { data: current, error: currentErr } = await supabase
      .from("avatars")
      .select("voice_profile_id, voice_profile:voice_profiles(*)")
      .eq("id", avatarId)
      .maybeSingle();
    // Without the current row the old legacy voice columns would stay set.
    if (currentErr) return avatarReadFailed(avatarId, currentErr);
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
    console.error("[admin/avatars/voice] assign failed", {
      avatarId,
      error: error?.message ?? "no row",
    });
    return NextResponse.json(
      { error: clientSafeError("Assign failed", error) },
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

function avatarReadFailed(avatarId: string, error: { message: string }) {
  console.error("[admin/avatars/voice] avatar read failed", {
    avatarId,
    error: error.message,
  });
  return NextResponse.json(
    { error: clientSafeError("Assign failed", error) },
    { status: 500 },
  );
}

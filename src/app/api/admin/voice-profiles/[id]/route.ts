import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  clinicalParamsFromRow,
  clinicalParamsPatchFromBody,
  validateClinicalVoiceParams,
} from "@/lib/clinical-voice";
import type { VoiceProfile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: update a voice profile (active flag + Mission 3 clinical params).
 * Body may include any subset of:
 *   is_active, voice_name, dialect, gender,
 *   speech_rate, pitch, energy, prosody, breathing,
 *   hesitation_frequency, speaker_boost, emotion_modulation,
 *   pronunciation_ar, pronunciation_en
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.voice_profile.update",
    resourceType: "voice_profile",
    resourceId: id,
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

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  const { data: existing, error: loadError } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json(
      { error: loadError?.message ?? "Voice profile not found" },
      { status: loadError ? 500 : 404 },
    );
  }

  const patch: Record<string, unknown> = {};

  if ("is_active" in body) {
    if (typeof body.is_active !== "boolean") {
      return NextResponse.json(
        { error: "is_active must be boolean" },
        { status: 400 },
      );
    }
    patch.is_active = body.is_active;
  }

  if ("voice_name" in body) {
    if (typeof body.voice_name !== "string" || !body.voice_name.trim()) {
      return NextResponse.json(
        { error: "voice_name must be a non-empty string" },
        { status: 400 },
      );
    }
    patch.voice_name = body.voice_name.trim().slice(0, 120);
  }

  if ("dialect" in body) {
    if (body.dialect != null && typeof body.dialect !== "string") {
      return NextResponse.json(
        { error: "dialect must be string or null" },
        { status: 400 },
      );
    }
    patch.dialect =
      typeof body.dialect === "string"
        ? body.dialect.trim().slice(0, 120) || null
        : null;
  }

  if ("gender" in body) {
    if (body.gender != null && typeof body.gender !== "string") {
      return NextResponse.json(
        { error: "gender must be string or null" },
        { status: 400 },
      );
    }
    patch.gender =
      typeof body.gender === "string"
        ? body.gender.trim().slice(0, 40) || null
        : null;
  }

  const clinicalPatch = clinicalParamsPatchFromBody(body);
  if (Object.keys(clinicalPatch).length > 0) {
    const base = clinicalParamsFromRow(existing as VoiceProfile);
    const validated = validateClinicalVoiceParams(clinicalPatch, base);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    Object.assign(patch, validated.value);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "No recognized fields to update" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("voice_profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed" },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    action: "admin.voice_profile.update",
    outcome: "success",
    resourceType: "voice_profile",
    resourceId: id,
    metadata: { fields: Object.keys(patch) },
    request,
  });

  return NextResponse.json({ voiceProfile: data });
}

/** Admin: read one voice profile (includes clinical params). */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.voice_profile.read",
    resourceType: "voice_profile",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ voiceProfile: data });
}

import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { isUuid } from "@/lib/skill-tests";

/**
 * Superadmin assigns a patient to a trainee (or removes it). A trainee with
 * any assigned patient practises only with those patients, as therapy
 * courses (see lib/assigned-patients.ts).
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.trainee_patient.change",
    resourceType: "trainee_patient_assignment",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-trainee-patient:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { traineeId?: unknown; avatarId?: unknown; assign?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isUuid(body.traineeId) || !isUuid(body.avatarId) || typeof body.assign !== "boolean") {
    return NextResponse.json(
      { error: "traineeId, avatarId and assign are required" },
      { status: 400 },
    );
  }
  const traineeId = body.traineeId;
  const avatarId = body.avatarId;

  if (body.assign) {
    const { data: avatar, error: avatarError } = await supabase
      .from("avatars")
      .select("id, is_active")
      .eq("id", avatarId)
      .maybeSingle();
    if (avatarError) {
      console.error("[admin/accounts/patients] avatar read failed", {
        avatarId,
        code: avatarError.code,
      });
      return NextResponse.json(
        { error: clientSafeError("Could not update the assigned patients", avatarError) },
        { status: 500 },
      );
    }
    if (!avatar?.is_active) {
      return NextResponse.json(
        { error: "That patient is not published", code: "PATIENT_UNAVAILABLE" },
        { status: 409 },
      );
    }
  }

  // RLS can filter a write to zero rows without an error (for example an
  // admin token without two-step login), so both paths read back what they
  // changed.
  let error: { message: string; code?: string } | null = null;
  let applied = false;
  if (body.assign) {
    const upsert = await supabase
      .from("trainee_patient_assignments")
      .upsert(
        { trainee_id: traineeId, avatar_id: avatarId, assigned_by: user.id },
        { onConflict: "trainee_id,avatar_id", ignoreDuplicates: true },
      );
    error = upsert.error;
    if (!error) {
      const check = await supabase
        .from("trainee_patient_assignments")
        .select("avatar_id")
        .eq("trainee_id", traineeId)
        .eq("avatar_id", avatarId)
        .maybeSingle();
      error = check.error;
      applied = Boolean(check.data);
    }
  } else {
    const removed = await supabase
      .from("trainee_patient_assignments")
      .delete()
      .eq("trainee_id", traineeId)
      .eq("avatar_id", avatarId)
      .select("avatar_id");
    error = removed.error;
    applied = (removed.data?.length ?? 0) > 0;
  }

  if (error) {
    // 23503: the trainee or patient no longer exists.
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Account or patient not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    console.error("[admin/accounts/patients] update failed", {
      traineeId,
      avatarId,
      assign: body.assign,
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not update the assigned patients", error) },
      { status: 500 },
    );
  }
  if (!applied) {
    console.error("[admin/accounts/patients] change not applied", {
      traineeId,
      avatarId,
      assign: body.assign,
    });
    return NextResponse.json(
      { error: "Could not update the assigned patients", code: "NOT_UPDATED" },
      { status: 409 },
    );
  }

  await logSecurityEvent({
    action: body.assign ? "admin.trainee_patient.assign" : "admin.trainee_patient.unassign",
    outcome: "success",
    resourceType: "trainee_patient_assignment",
    resourceId: traineeId,
    metadata: { avatarId },
    request,
  });
  return NextResponse.json({ ok: true, traineeId, avatarId, assigned: body.assign });
}

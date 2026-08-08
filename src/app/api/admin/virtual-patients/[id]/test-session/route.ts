import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { rateLimit } from "@/lib/rate-limit";
import { messageRpcClient } from "@/lib/supabase/admin";
import { normalizeAvatarLocale } from "@/lib/avatars/resolve";
import { createCaseForSession } from "@/lib/case-engine/persist";
import { MAX_SESSION_SECONDS, type Avatar } from "@/lib/types";
import { shouldUseTherapyRoom } from "@/lib/therapy-room";
import { getVirtualPatient, readLifecycle } from "@/lib/admin/virtual-patients";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Start an ADMIN TEST session for a Virtual Patient (including draft/testing).
 * Marks clinical_snapshot.admin_test so end skips learner assessment/report.
 */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.virtual_patients.test_session",
    resourceType: "virtual_patient",
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-vp-test:${user.id}`,
    20,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const vp = await getVirtualPatient(supabase, id);
  if (!vp.ok) {
    return NextResponse.json(
      { error: clientSafeError("Virtual patient not found", vp.error) },
      { status: 404 },
    );
  }
  if (readLifecycle(vp.avatar) === "archived") {
    return NextResponse.json(
      { error: "Archived virtual patients cannot be tested." },
      { status: 409 },
    );
  }

  let body: { interactionMode?: "classic" | "therapy_room"; locale?: string } =
    {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  const typedAvatar = vp.avatar as Avatar;
  const effectiveLocale = normalizeAvatarLocale(
    body.locale ??
      typedAvatar.default_locale ??
      typedAvatar.language ??
      "en-US",
  );

  const caseResult = await createCaseForSession(supabase, {
    avatar: typedAvatar,
    locale: effectiveLocale,
    therapistId: user.id,
  });
  if (!caseResult.ok) {
    return NextResponse.json(
      { error: caseResult.error },
      { status: caseResult.status },
    );
  }

  const snapshot = {
    ...caseResult.snapshot,
    admin_test: true,
    admin_test_label: "ADMIN TEST — NOT A LEARNER SESSION",
  };

  const interactionMode = shouldUseTherapyRoom(body.interactionMode)
    ? "therapy_room"
    : "classic";

  const insertPayload: Record<string, unknown> = {
    therapist_id: user.id,
    avatar_id: id,
    status: "active",
    max_duration_sec: caseResult.maxDurationSec ?? MAX_SESSION_SECONDS,
    language: caseResult.snapshot.locale || effectiveLocale,
    case_instance_id: caseResult.caseInstanceId.startsWith("VPSY-")
      ? null
      : caseResult.caseInstanceId,
    clinical_snapshot: snapshot,
    difficulty: caseResult.difficulty,
    therapy_modality: caseResult.therapyModality,
    interaction_mode: interactionMode,
  };

  const { data: session, error } = await supabase
    .from("sessions")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: clientSafeError("Failed to start test session", error) },
      { status: 500 },
    );
  }

  const writer = messageRpcClient(supabase);
  await writer.rpc("insert_system_message", {
    p_session_id: session.id,
    p_content:
      "ADMIN TEST — NOT A LEARNER SESSION. Speak with the patient to verify behavior. Ending will not create a learner assessment.",
  });

  await logSecurityEvent({
    action: "admin.virtual_patients.test_session",
    outcome: "success",
    resourceType: "session",
    resourceId: session.id,
    metadata: { avatarId: id, interactionMode },
    request,
  });

  const path =
    interactionMode === "therapy_room"
      ? `/clinic/room/${session.id}?adminTest=1`
      : `/sessions/${session.id}?adminTest=1`;

  return NextResponse.json({
    sessionId: session.id,
    path,
    adminTest: true,
  });
}

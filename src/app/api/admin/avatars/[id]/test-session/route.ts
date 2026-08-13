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
import {
  ADMIN_TEST_LABEL,
  assertAvatarEligibleForAdminTest,
  withAdminTestMarker,
} from "@/lib/admin/admin-test-session";
import {
  readLifecycleFromRow,
  type VirtualPatientLifecycleStatus,
} from "@/lib/admin/virtual-patient-lifecycle";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/avatars/[id]/test-session
 * Phase 3C — start an Admin Test Conversation (persistent, admin_test marked).
 * Reuses createCaseForSession + sessions engine. Does not assess on end.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.test_session",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-test:${user.id}`,
    20,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { interactionMode?: "classic" | "therapy_room"; locale?: string } =
    {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  const { data: avatar, error: avatarError } = await supabase
    .from("avatars")
    .select(
      "id, name, disorder, age, gender, is_active, language, default_locale, slug, schema_version, clinical_core, personalities, voice_id, voice_id_ar, voice_profile_id, persona_prompt, ideal_guidelines, rubric, lifecycle_status, human_personality",
    )
    .eq("id", id)
    .maybeSingle();

  if (avatarError || !avatar) {
    await logSecurityEvent({
      action: "admin.avatar.test_session",
      outcome: "failure",
      resourceType: "avatar",
      resourceId: id,
      metadata: { reason: "not_found" },
      request,
    });
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const typedAvatar = avatar as Avatar;
  const lifecycle = readLifecycleFromRow(
    typedAvatar,
  ) as VirtualPatientLifecycleStatus;
  const eligibility = assertAvatarEligibleForAdminTest(lifecycle);
  if (!eligibility.ok) {
    await logSecurityEvent({
      action: "admin.avatar.test_session",
      outcome: "failure",
      resourceType: "avatar",
      resourceId: id,
      metadata: { lifecycle, reason: "ineligible" },
      request,
    });
    return NextResponse.json(
      { error: eligibility.error },
      { status: eligibility.status },
    );
  }

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
    // testing lifecycle keeps avatar/persona inactive for learners; mint still
    // needs an in-memory active persona for case-engine validation.
    allowInactivePersona: true,
  });
  if (!caseResult.ok) {
    await logSecurityEvent({
      action: "admin.avatar.test_session",
      outcome: "failure",
      resourceType: "avatar",
      resourceId: id,
      metadata: { lifecycle, reason: "case_mint_failed" },
      request,
    });
    return NextResponse.json(
      { error: caseResult.error },
      { status: caseResult.status },
    );
  }

  // Authoritative marker — only this route may set admin_test.
  const snapshot = withAdminTestMarker(caseResult.snapshot);

  const interactionMode = shouldUseTherapyRoom(body.interactionMode)
    ? "therapy_room"
    : "classic";

  const insertPayload: Record<string, unknown> = {
    therapist_id: user.id,
    avatar_id: id,
    status: "active",
    max_duration_sec: caseResult.maxDurationSec ?? MAX_SESSION_SECONDS,
    language: snapshot.locale || effectiveLocale,
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
    await logSecurityEvent({
      action: "admin.avatar.test_session",
      outcome: "failure",
      resourceType: "avatar",
      resourceId: id,
      metadata: { lifecycle, reason: "session_insert_failed" },
      request,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to start test session", error) },
      { status: 500 },
    );
  }

  const writer = messageRpcClient(supabase);
  const { error: sysErr } = await writer.rpc("insert_system_message", {
    p_session_id: session.id,
    p_content: `${ADMIN_TEST_LABEL}. Speak with the patient to verify behavior. Ending will not create a learner assessment.`,
  });
  if (sysErr) {
    console.error("[admin/test-session] system message failed", {
      sessionId: session.id,
      error: sysErr.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to start test session", sysErr) },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    action: "admin.avatar.test_session",
    outcome: "success",
    resourceType: "session",
    resourceId: session.id,
    metadata: {
      avatarId: id,
      sessionId: session.id,
      lifecycle,
      interactionMode,
      locale: snapshot.locale || effectiveLocale,
    },
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
    language: snapshot.locale || effectiveLocale,
    interactionMode,
    caseInstanceId: caseResult.caseInstanceId,
    assessmentId: snapshot.assessment_id,
  });
}

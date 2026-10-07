import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { requireApiSupervisor } from "@/lib/skill-tests/access";
import { randomUUID } from "crypto";
import {
  SKILL_TEST_SEAL_UNAVAILABLE,
  isPatientCompatible,
  sealSkillTestSpec,
  validateSkillTestInput,
  type SkillTestValidationError,
} from "@/lib/skill-tests";
import { loadLadderAvatarIds } from "@/lib/training-ladder";

const VALIDATION_MESSAGES: Record<SkillTestValidationError, string> = {
  trainee_required: "Choose the trainee to assign this patient to.",
  patient_required: "Choose a patient.",
  title_invalid: "Give the test a title of up to 120 characters.",
  language_invalid: "Choose English or Arabic.",
  disorder_invalid: "Choose a disorder from the list.",
  comorbidity_invalid:
    "Choose up to two comorbidities the case engine supports with this disorder.",
  difficulty_invalid: "Choose a difficulty.",
  severity_invalid: "Choose a severity from the list.",
  sessions_invalid: "Required sessions must be between 1 and 12.",
  instructions_too_long: "Instructions can be up to 1000 characters.",
  due_date_invalid: "The due date must be today or later.",
};

/** Supervisor designs a test patient and assigns it to one trainee. */
export async function POST(request: Request) {
  const auth = await requireApiSupervisor(request, {
    action: "skill_test.create",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`skilltest:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = validateSkillTestInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: VALIDATION_MESSAGES[parsed.error], code: parsed.error },
      { status: 400 },
    );
  }
  const input = parsed.value;
  if (input.traineeId === user.id) {
    return NextResponse.json(
      { error: "You cannot assign a test to yourself.", code: "trainee_required" },
      { status: 400 },
    );
  }

  const { data: trainees, error: traineeErr } = await supabase.rpc(
    "list_skill_test_trainees",
  );
  if (traineeErr) {
    return NextResponse.json(
      { error: clientSafeError("Could not load trainees", traineeErr) },
      { status: 500 },
    );
  }
  const trainee = ((trainees ?? []) as Array<{ id: string }>).find(
    (t) => t.id === input.traineeId,
  );
  if (!trainee) {
    return NextResponse.json(
      { error: VALIDATION_MESSAGES.trainee_required, code: "trainee_required" },
      { status: 400 },
    );
  }

  const { data: avatar } = await supabase
    .from("avatars")
    .select("id, is_active, age, gender")
    .eq("id", input.avatarId)
    .maybeSingle();
  if (!avatar?.is_active) {
    return NextResponse.json(
      { error: VALIDATION_MESSAGES.patient_required, code: "patient_required" },
      { status: 400 },
    );
  }
  // Training Program patients are written for the ladder and are not offered
  // in the picker; refuse a hand-crafted request for one too.
  if ((await loadLadderAvatarIds(supabase)).has(avatar.id as string)) {
    return NextResponse.json(
      {
        error:
          "This patient belongs to the Training Program and cannot be used in a test. Choose another patient.",
        code: "ladder_patient_only",
      },
      { status: 400 },
    );
  }
  if (
    !isPatientCompatible(input.disorderSlug, {
      age: avatar.age as number | null,
      gender: avatar.gender as string | null,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "This patient's age or gender does not fit the chosen disorder. Choose another patient or disorder.",
        code: "patient_incompatible",
      },
      { status: 400 },
    );
  }

  // The trainee's copy of the spec is sealed: an exam case stays unknown to
  // them until they work it out (see lib/skill-tests/exam.ts).
  const assignmentId = randomUUID();
  const sealedSpec = sealSkillTestSpec(assignmentId, {
    disorder_slug: input.disorderSlug,
    comorbidity_slugs: input.comorbiditySlugs,
    difficulty: input.difficulty,
    severity: input.severity,
  });
  if (!sealedSpec) {
    return NextResponse.json(
      { error: SKILL_TEST_SEAL_UNAVAILABLE, code: "skill_test_unavailable" },
      { status: 503 },
    );
  }

  const { data: created, error } = await supabase
    .from("skill_test_assignments")
    .insert({
      id: assignmentId,
      supervisor_id: user.id,
      trainee_id: input.traineeId,
      avatar_id: input.avatarId,
      title: input.title,
      language: input.language,
      disorder_slug: input.disorderSlug,
      comorbidity_slugs: input.comorbiditySlugs,
      difficulty: input.difficulty,
      severity: input.severity,
      required_sessions: input.requiredSessions,
      trainee_instructions: input.traineeInstructions,
      due_at: input.dueAt,
      sealed_spec: sealedSpec,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.warn("[skill-tests] create failed", { error: error?.message });
    return NextResponse.json(
      { error: clientSafeError("Could not assign the test", error) },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    action: "skill_test.create",
    outcome: "success",
    resourceType: "skill_test",
    resourceId: created.id,
    metadata: { traineeId: input.traineeId },
    request,
  });

  return NextResponse.json({ ok: true, id: created.id });
}

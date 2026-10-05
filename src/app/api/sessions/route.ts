import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prepareMessageRpc } from "@/lib/supabase/admin";
import { normalizeAvatarLocale } from "@/lib/avatars/resolve";
import { createCaseForSession } from "@/lib/case-engine/persist";
import type {
  CaseDifficulty,
  TherapyModality,
} from "@/lib/case-engine/types";
import {
  findPresetById,
  findPresetBySlug,
} from "@/lib/instructor-presets";
import {
  createMindState,
  embedMindState,
  loadDyadClinicalCarry,
} from "@/lib/clinical-intelligence";
import { embedAdaptationInMemory } from "@/lib/adaptation";
import { MAX_SESSION_SECONDS, type Avatar } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { NEW_SESSION_INTERACTION_MODE } from "@/lib/therapy-room";
import { stripAdminTestMarker } from "@/lib/admin/admin-test-session";
import {
  buildCourseSessionContext,
  countCourseSessions,
  createCourse,
  decideCourseStart,
  isPlanNew,
  loadActiveCourse,
} from "@/lib/therapy-course";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import {
  buildSkillTestSessionContext,
  loadSkillTestStart,
  skillTestDbError,
} from "@/lib/skill-tests";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`start:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    avatarId?: string;
    /** Optional; falls back to profile preferred_language then avatar default. */
    locale?: string;
    language?: string;
    /** Case Engine — optional diagnosis override (slug). */
    disorderSlug?: string;
    comorbiditySlugs?: string[];
    difficulty?: CaseDifficulty;
    therapyModality?: TherapyModality;
    severity?: "subclinical" | "mild" | "moderate" | "severe";
    /** @deprecated alias for disorderSlug */
    caseId?: string;
    /** Clinical Scenario Template Engine */
    templateId?: string;
    templateSlug?: string;
    /** Instructor Preset Engine — objectives drive case generation */
    presetId?: string;
    presetSlug?: string;
    /** Advanced Mode diagnosis pin (requires preset.advanced_mode) */
    disorderSlugOverride?: string;
    /** Supervisor-assigned skill test; the assignment decides the case. */
    skillTestId?: string;
  };

  // Skill test — the supervisor's assignment fixes patient, language and case.
  const skillTest = body.skillTestId
    ? await loadSkillTestStart(supabase, {
        userId: user.id,
        skillTestId: body.skillTestId,
      })
    : null;
  if (skillTest && !skillTest.ok) {
    return NextResponse.json(
      { error: skillTest.error, code: skillTest.code },
      { status: skillTest.status },
    );
  }
  const test = skillTest?.ok ? skillTest : null;
  if (test) body.avatarId = test.assignment.avatar_id;

  if (!body.avatarId) {
    return NextResponse.json({ error: "avatarId required" }, { status: 400 });
  }

  const { data: avatar, error: avatarError } = await supabase
    .from("avatars")
    .select(
      "id, name, disorder, age, gender, is_active, language, default_locale, slug, schema_version, clinical_core, personalities, voice_id, voice_id_ar, voice_profile_id, persona_prompt, ideal_guidelines, rubric",
    )
    .eq("id", body.avatarId)
    .single();

  if (avatarError || !avatar?.is_active) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const typedAvatar = avatar as Avatar;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, primary_institution_id")
    .eq("id", user.id)
    .maybeSingle();

  // Therapy course — a plain "see this patient again" start continues the
  // open course with the same pinned case. Explicit case/preset requests stay
  // standalone sessions, exactly as before courses existed.
  const requestsSpecificCase = Boolean(
    test ||
      body.disorderSlug ||
      body.caseId ||
      body.comorbiditySlugs?.length ||
      body.templateId ||
      body.templateSlug ||
      body.presetId ||
      body.presetSlug ||
      body.disorderSlugOverride,
  );
  const courseLookup = requestsSpecificCase
    ? ({ available: false } as const)
    : await loadActiveCourse(supabase, {
        therapistId: user.id,
        avatarId: body.avatarId,
      });
  let courseDecision: ReturnType<typeof decideCourseStart> | null = null;
  let planIsNew = false;
  if (courseLookup.available) {
    let sessionCount = 0;
    let lastSessionStartedAt: string | null = null;
    if (courseLookup.course) {
      const counts = await countCourseSessions(
        supabase,
        courseLookup.course.id,
      );
      if (!counts) {
        return NextResponse.json(
          { error: "Could not load your therapy course. Please try again." },
          { status: 500 },
        );
      }
      sessionCount = counts.total;
      lastSessionStartedAt = counts.lastStartedAt;
    }
    courseDecision = decideCourseStart(courseLookup.course, sessionCount);
    planIsNew = courseLookup.course
      ? isPlanNew(courseLookup.course, lastSessionStartedAt)
      : false;
    if (courseDecision.kind === "plan_required") {
      return NextResponse.json(
        {
          error:
            "Write the treatment plan for this patient before starting session 3.",
          code: "treatment_plan_required",
          courseId: courseDecision.course.id,
        },
        { status: 409 },
      );
    }
    if (courseDecision.kind === "course_finished") {
      return NextResponse.json(
        {
          error:
            "This course has reached its planned number of sessions. End or extend it from the course page.",
          code: "course_length_reached",
          courseId: courseDecision.course.id,
        },
        { status: 409 },
      );
    }
  }
  const continuing =
    courseDecision?.kind === "continue" ? courseDecision : null;

  const builtinPreset =
    (body.presetId ? findPresetById(body.presetId) : undefined) ??
    (body.presetSlug ? findPresetBySlug(body.presetSlug) : undefined);

  // Explicit locale wins; else preset language; else profile/avatar defaults
  const sessionLanguage = normalizeAvatarLocale(
    body.locale ??
      body.language ??
      builtinPreset?.language ??
      profile?.preferred_language ??
      typedAvatar.default_locale ??
      typedAvatar.language,
  );
  // A continuing course keeps the patient's locale: en-US and ar-JO are
  // different people, so the course never switches personality mid-therapy.
  const effectiveLocale = test
    ? test.assignment.language
    : continuing
    ? normalizeAvatarLocale(
        continuing.course.clinical_snapshot.locale ??
          continuing.course.language ??
          sessionLanguage,
      )
    : sessionLanguage;

  // Module 7 — generate immutable CaseInstance for this assessment. A
  // continuing therapy course reuses the case pinned when the course began.
  const pinnedTestSnapshot = test?.assignment.clinical_snapshot ?? null;
  const testCase =
    test && pinnedTestSnapshot
      ? caseFromCourse({
          case_instance_id: test.assignment.case_instance_id,
          clinical_snapshot: pinnedTestSnapshot,
          max_duration_sec: null,
        })
      : null;
  const caseResult = continuing
    ? caseFromCourse(continuing.course)
    : testCase
    ? testCase
    : test
    ? await createCaseForSession(supabase, {
        avatar: typedAvatar,
        locale: effectiveLocale,
        therapistId: user.id,
        disorderSlug: test.assignment.disorder_slug,
        comorbiditySlugs: test.assignment.comorbidity_slugs,
        difficulty: test.assignment.difficulty,
        severity: test.assignment.severity ?? undefined,
      })
    : await createCaseForSession(supabase, {
    avatar: typedAvatar,
    locale: effectiveLocale,
    therapistId: user.id,
    disorderSlug: body.disorderSlug ?? body.caseId,
    comorbiditySlugs: body.comorbiditySlugs,
    difficulty: body.difficulty,
    therapyModality: body.therapyModality,
    severity: body.severity,
    templateId: body.templateId,
    templateSlug: body.templateSlug,
    presetId: body.presetId,
    presetSlug: body.presetSlug,
    disorderSlugOverride: body.disorderSlugOverride,
  });

  if (!caseResult.ok) {
    return NextResponse.json(
      { error: caseResult.error },
      { status: caseResult.status },
    );
  }

  const maxDurationSec =
    caseResult.maxDurationSec ?? MAX_SESSION_SECONDS;

  // The Therapy Room is the only session experience; the body cannot opt out.
  const interactionMode = NEW_SESSION_INTERACTION_MODE;

  // Phase 3C — learner create path must never persist admin_test markers.
  const baseSnapshot = stripAdminTestMarker(caseResult.snapshot);
  const persistedCaseId = caseResult.caseInstanceId.startsWith("VPSY-")
    ? null
    : caseResult.caseInstanceId;

  // Open a course on the first plain start with this patient. Best-effort: if
  // it cannot be created the session still runs as a standalone session.
  let course = continuing?.course ?? null;
  let courseSessionNumber = continuing?.sessionNumber ?? null;
  if (courseDecision?.kind === "new_course") {
    course = await createCourse(supabase, {
      therapistId: user.id,
      avatarId: body.avatarId,
      caseInstanceId: persistedCaseId,
      snapshot: baseSnapshot,
      language: baseSnapshot.locale || effectiveLocale,
      maxDurationSec,
    });
    courseSessionNumber = course ? 1 : null;
  }
  const learnerSnapshot: CaseInstanceSnapshot = test
    ? {
        ...baseSnapshot,
        therapy_course: buildSkillTestSessionContext({
          assignmentId: test.assignment.id,
          sessionNumber: test.sessionNumber,
          requiredSessions: test.assignment.required_sessions,
        }),
      }
    : course && courseSessionNumber
      ? {
          ...baseSnapshot,
          therapy_course: buildCourseSessionContext({
            courseId: course.id,
            sessionNumber: courseSessionNumber,
            plannedSessions: course.planned_sessions,
            treatmentPlan: course.treatment_plan,
            planIsNew,
          }),
        }
      : baseSnapshot;

  // Tenant stamp from server-side profile (never from browser body).
  // Historical sessions keep this value even if the learner later changes org.
  const insertPayload: Record<string, unknown> = {
    therapist_id: user.id,
    avatar_id: body.avatarId,
    status: "active",
    max_duration_sec: maxDurationSec,
    language: learnerSnapshot.locale || effectiveLocale,
    case_instance_id: persistedCaseId,
    clinical_snapshot: learnerSnapshot,
    difficulty: caseResult.difficulty,
    therapy_modality: caseResult.therapyModality,
    instructor_preset_id: caseResult.preset?.id ?? null,
    interaction_mode: interactionMode,
    institution_id: profile?.primary_institution_id ?? null,
  };
  if (test) {
    insertPayload.skill_test_assignment_id = test.assignment.id;
  }
  if (course && courseSessionNumber) {
    insertPayload.therapy_course_id = course.id;
    insertPayload.course_session_number = courseSessionNumber;
  }

  let { data: session, error } = await supabase
    .from("sessions")
    .insert(insertPayload)
    .select("id")
    .single();

  // Backward compatible: if new columns are missing (migration not applied), retry legacy insert
  // A skill test session is never retried without its test link.
  if (
    error &&
    !test &&
    /clinical_snapshot|case_instance_id|difficulty|therapy_modality|instructor_preset|interaction_mode/i.test(
      error.message,
    )
  ) {
    const withoutPreset = { ...insertPayload };
    delete withoutPreset.instructor_preset_id;
    delete withoutPreset.interaction_mode;
    const retry = await supabase
      .from("sessions")
      .insert(withoutPreset)
      .select("id")
      .single();
    if (
      retry.error &&
      /clinical_snapshot|case_instance_id|difficulty|therapy_modality|interaction_mode/i.test(
        retry.error.message,
      )
    ) {
      // Legacy schema fallback still stamps tenancy from the server profile.
      // Never omit institution_id when the column exists (M23+).
      const legacy = await supabase
        .from("sessions")
        .insert({
          therapist_id: user.id,
          avatar_id: body.avatarId,
          status: "active",
          max_duration_sec: maxDurationSec,
          language: caseResult.snapshot.locale || effectiveLocale,
          institution_id: profile?.primary_institution_id ?? null,
        })
        .select("id")
        .single();
      session = legacy.data;
      error = legacy.error;
    } else {
      session = retry.data;
      error = retry.error;
    }
  }

  const testRejection = test ? skillTestDbError(error?.message) : null;
  if (testRejection) {
    return NextResponse.json(
      { error: testRejection.message, code: testRejection.code },
      { status: testRejection.status },
    );
  }

  if (error || !session) {
    console.error("[sessions] create failed", { error: error?.message });
    return NextResponse.json(
      { error: clientSafeError("Failed to create session", error) },
      { status: 500 },
    );
  }

  const systemContent = "Session started. Speak with the patient avatar.";
  const prepared = prepareMessageRpc(supabase, {
    sessionId: session.id,
    content: systemContent,
    role: "system",
  });
  if (!prepared.ok) {
    console.error("[sessions] system message signing unavailable", {
      sessionId: session.id,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to start session", prepared.error) },
      { status: 500 },
    );
  }
  const { error: sysErr } = await prepared.client.rpc(
    "insert_system_message",
    prepared.args,
  );

  if (sysErr) {
    console.error("[sessions] system message failed", {
      sessionId: session.id,
      error: sysErr.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to start session", sysErr) },
      { status: 500 },
    );
  }

  // Stage 6 — seed case_memory with dyad Adaptation carry + CI mind state (R-I1).
  // Best-effort; never blocks session create.
  // A continuing course already has case_memory for its case; keep it.
  const newCaseId = continuing || testCase ? null : persistedCaseId;
  if (newCaseId) {
    try {
      const carry = await loadDyadClinicalCarry(supabase, {
        therapistId: user.id,
        avatarId: body.avatarId!,
        excludeSessionId: session.id,
        newCaseInstanceId: newCaseId,
      });
      const mind =
        carry.mind ??
        createMindState({
          caseInstanceId: newCaseId,
          formulation: caseResult.snapshot.clinical_core?.formulation ?? null,
        });
      let memory: Record<string, unknown> = {};
      if (carry.adaptation) {
        memory = embedAdaptationInMemory(memory, carry.adaptation);
      }
      memory = embedMindState(memory, {
        ...mind,
        case_instance_id: newCaseId,
      });
      void supabase.from("case_memory").upsert({
        case_instance_id: newCaseId,
        memory,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[sessions] clinical intelligence seed soft-fail", {
        sessionId: session.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    sessionId: session.id,
    language: caseResult.snapshot.locale || effectiveLocale,
    assessmentId: caseResult.snapshot.assessment_id,
    caseInstanceId: caseResult.caseInstanceId,
    diagnosis: caseResult.snapshot.primary_diagnosis.name,
    difficulty: caseResult.difficulty,
    therapyModality: caseResult.therapyModality,
    templateId: caseResult.snapshot.template?.id ?? null,
    templateSlug: caseResult.snapshot.template?.slug ?? null,
    presetId: caseResult.preset?.id ?? null,
    presetSlug: caseResult.preset?.slug ?? null,
    primaryObjective: caseResult.preset?.primary_objective ?? null,
    maxDurationSec,
    interactionMode,
    courseId: course?.id ?? null,
    courseSessionNumber,
    skillTestId: test?.assignment.id ?? null,
    testSessionNumber: test?.sessionNumber ?? null,
  });
}

/** Case result for a session that continues an open therapy course. */
function caseFromCourse(course: {
  case_instance_id: string | null;
  clinical_snapshot: CaseInstanceSnapshot;
  max_duration_sec: number | null;
}) {
  const snapshot = course.clinical_snapshot;
  return {
    ok: true as const,
    caseInstanceId:
      course.case_instance_id ??
      snapshot.case_instance_id ??
      snapshot.assessment_id,
    snapshot,
    difficulty: snapshot.difficulty,
    therapyModality: snapshot.therapy_modality,
    preset: undefined,
    maxDurationSec: course.max_duration_sec ?? undefined,
  };
}

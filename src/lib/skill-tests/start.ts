/**
 * Starting a session for a supervisor-assigned skill test.
 *
 * The test reuses the existing clinical engine: the first session mints a
 * case from the supervisor's spec through the Case Engine, the database pins
 * it (sealed, see ./exam.ts), and later sessions reuse it. Visit awareness comes from
 * the existing therapy course prompt block (`clinical_snapshot.therapy_course`)
 * with no treatment plan, so the Patient Agent gains no new behaviour.
 * The database triggers in 20261005110000_supervisor_skill_tests.sql enforce
 * the same rules; these helpers give clear errors before the insert.
 * The trainee never sees the case: see ./exam.ts.
 */

import type {
  SkillTestAssignment,
  TherapyCourseSessionContext,
} from "@/lib/types";

/** Columns a supervisor or admin reads; trainees use `my_skill_tests()`. */
export const SKILL_TEST_COLUMNS =
  "id, supervisor_id, trainee_id, avatar_id, title, language, disorder_slug, comorbidity_slugs, difficulty, severity, required_sessions, trainee_instructions, due_at, status, sealed_spec, sealed_case, started_at, completed_at, cancelled_at, created_at, updated_at";

/**
 * A trainee's own assignment, as `my_skill_tests()` returns it: no disorder,
 * comorbidities, difficulty or severity, and the spec and case only sealed.
 */
export type TraineeSkillTest = Pick<
  SkillTestAssignment,
  | "id"
  | "trainee_id"
  | "avatar_id"
  | "title"
  | "language"
  | "required_sessions"
  | "trainee_instructions"
  | "due_at"
  | "status"
  | "sealed_spec"
  | "sealed_case"
  | "started_at"
  | "completed_at"
  | "created_at"
>;

export type SkillTestBlockedCode =
  | "skill_test_not_assigned"
  | "skill_test_closed"
  | "skill_test_session_active"
  | "skill_test_sessions_used";

export type SkillTestStartDecision =
  | { kind: "start"; sessionNumber: number; isFinal: boolean }
  | { kind: "blocked"; code: SkillTestBlockedCode };

export type SkillTestSessionRow = {
  status: string;
  started_at: string;
  max_duration_sec: number;
};

/** True while a session still holds the room (active and within its time). */
export function isSessionLive(
  row: SkillTestSessionRow,
  now: Date = new Date(),
): boolean {
  if (row.status !== "active") return false;
  const end =
    new Date(row.started_at).getTime() + (row.max_duration_sec ?? 0) * 1000;
  return end > now.getTime();
}

export function decideSkillTestStart(
  assignment: Pick<
    SkillTestAssignment,
    "trainee_id" | "status" | "required_sessions"
  > | null,
  userId: string,
  sessions: SkillTestSessionRow[],
  now: Date = new Date(),
): SkillTestStartDecision {
  if (!assignment || assignment.trainee_id !== userId) {
    return { kind: "blocked", code: "skill_test_not_assigned" };
  }
  if (assignment.status !== "assigned" && assignment.status !== "in_progress") {
    return { kind: "blocked", code: "skill_test_closed" };
  }
  if (sessions.some((s) => isSessionLive(s, now))) {
    return { kind: "blocked", code: "skill_test_session_active" };
  }
  if (sessions.length >= assignment.required_sessions) {
    return { kind: "blocked", code: "skill_test_sessions_used" };
  }
  const sessionNumber = sessions.length + 1;
  return {
    kind: "start",
    sessionNumber,
    isFinal: sessionNumber === assignment.required_sessions,
  };
}

/** Visit context for the patient prompt (no treatment plan in a test). */
export function buildSkillTestSessionContext(opts: {
  assignmentId: string;
  sessionNumber: number;
  requiredSessions: number;
}): TherapyCourseSessionContext {
  return {
    course_id: opts.assignmentId,
    session_number: opts.sessionNumber,
    planned_sessions: opts.requiredSessions,
    is_final_session: opts.sessionNumber === opts.requiredSessions,
    treatment_plan: null,
  };
}

const START_ERROR_MESSAGES: Record<
  SkillTestBlockedCode,
  { status: number; message: string }
> = {
  skill_test_not_assigned: {
    status: 404,
    message: "This test patient is not assigned to you.",
  },
  skill_test_closed: {
    status: 409,
    message: "This skill test is closed.",
  },
  skill_test_session_active: {
    status: 409,
    message:
      "A session for this test is still open. Finish it before starting the next one.",
  },
  skill_test_sessions_used: {
    status: 409,
    message: "All required sessions for this test have been held.",
  },
};

export function skillTestStartError(code: SkillTestBlockedCode) {
  return { code, ...START_ERROR_MESSAGES[code] };
}

/**
 * Map a database trigger rejection to a client-safe error. Returns null when
 * the error is not one of the skill test guards.
 */
export function skillTestDbError(
  message: string | null | undefined,
): { code: string; status: number; message: string } | null {
  if (!message) return null;
  for (const code of Object.keys(START_ERROR_MESSAGES) as SkillTestBlockedCode[]) {
    if (message.includes(code)) return skillTestStartError(code);
  }
  if (
    message.includes("skill_test_case_mismatch") ||
    message.includes("skill_test_wrong_patient")
  ) {
    return {
      code: "skill_test_case_mismatch",
      status: 409,
      message: "This session does not match the assigned test patient.",
    };
  }
  return null;
}

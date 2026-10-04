/**
 * Therapy course progression rules — pure, no I/O.
 *
 * A course is one trainee with one patient case. Sessions 1 and 2 run freely;
 * before session 3 the trainee must submit a treatment plan. The course ends
 * when the trainee terminates it or the planned number of sessions is reached.
 */

import type {
  TherapyCourse,
  TherapyCourseSessionContext,
  TreatmentPlan,
} from "@/lib/types";

/** Sessions completed before a treatment plan is required. */
export const PLAN_REQUIRED_AFTER_SESSIONS = 2;
/** Course length used until the treatment plan sets one. */
export const DEFAULT_PLANNED_SESSIONS = 8;
export const MIN_PLANNED_SESSIONS = 3;
export const MAX_PLANNED_SESSIONS = 20;

export type CourseStartDecision =
  | { kind: "new_course" }
  | {
      kind: "continue";
      course: TherapyCourse;
      sessionNumber: number;
      isFinal: boolean;
    }
  | { kind: "plan_required"; course: TherapyCourse; sessionNumber: number }
  | { kind: "course_finished"; course: TherapyCourse };

/**
 * Decide what starting a session with this patient means.
 * `sessionCount` is every session already attached to the course.
 */
export function decideCourseStart(
  course: TherapyCourse | null,
  sessionCount: number,
): CourseStartDecision {
  if (!course || course.status !== "active") return { kind: "new_course" };
  const sessionNumber = Math.max(0, sessionCount) + 1;
  if (sessionNumber > course.planned_sessions) {
    return { kind: "course_finished", course };
  }
  if (isPlanRequired(course, sessionCount)) {
    return { kind: "plan_required", course, sessionNumber };
  }
  return {
    kind: "continue",
    course,
    sessionNumber,
    isFinal: sessionNumber >= course.planned_sessions,
  };
}

/** True when the next session is blocked until a treatment plan exists. */
export function isPlanRequired(
  course: Pick<TherapyCourse, "status" | "treatment_plan">,
  sessionCount: number,
): boolean {
  return (
    course.status === "active" &&
    !course.treatment_plan &&
    sessionCount >= PLAN_REQUIRED_AFTER_SESSIONS
  );
}

/** True once the trainee may write (or revise) the treatment plan. */
export function canWritePlan(
  course: Pick<TherapyCourse, "status">,
  completedSessions: number,
): boolean {
  return (
    course.status === "active" &&
    completedSessions >= PLAN_REQUIRED_AFTER_SESSIONS
  );
}

/** Smallest course length a plan may set given the sessions already held. */
export function minPlannedSessions(sessionCount: number): number {
  return Math.min(
    MAX_PLANNED_SESSIONS,
    Math.max(MIN_PLANNED_SESSIONS, sessionCount + 1),
  );
}

/** Should the course close after the session numbered `sessionNumber` ends? */
export function shouldCompleteAfterSession(
  course: Pick<TherapyCourse, "status" | "planned_sessions">,
  sessionNumber: number | null | undefined,
): boolean {
  return (
    course.status === "active" &&
    typeof sessionNumber === "number" &&
    sessionNumber >= course.planned_sessions
  );
}

export function buildCourseSessionContext(opts: {
  courseId: string;
  sessionNumber: number;
  plannedSessions: number;
  treatmentPlan: TreatmentPlan | null;
}): TherapyCourseSessionContext {
  return {
    course_id: opts.courseId,
    session_number: opts.sessionNumber,
    planned_sessions: opts.plannedSessions,
    is_final_session: opts.sessionNumber >= opts.plannedSessions,
    treatment_plan: opts.treatmentPlan,
  };
}

export type CourseProgress = {
  sessionCount: number;
  completedCount: number;
  nextSessionNumber: number;
  planRequired: boolean;
  canWritePlan: boolean;
  lengthReached: boolean;
  /** True when a new session can start right now. */
  canStartNext: boolean;
  nextIsFinal: boolean;
  minPlannedSessions: number;
};

/** Everything the course UI needs, derived from the course and its sessions. */
export function courseProgress(
  course: Pick<TherapyCourse, "status" | "treatment_plan" | "planned_sessions">,
  sessions: Array<{ status: string }>,
): CourseProgress {
  const sessionCount = sessions.length;
  const completedCount = sessions.filter(
    (s) => s.status === "completed" || s.status === "expired",
  ).length;
  const nextSessionNumber = sessionCount + 1;
  const planRequired = isPlanRequired(course, sessionCount);
  const lengthReached =
    course.status === "active" && nextSessionNumber > course.planned_sessions;
  return {
    sessionCount,
    completedCount,
    nextSessionNumber,
    planRequired,
    canWritePlan: canWritePlan(course, completedCount),
    lengthReached,
    canStartNext: course.status === "active" && !planRequired && !lengthReached,
    nextIsFinal: nextSessionNumber >= course.planned_sessions,
    minPlannedSessions: minPlannedSessions(sessionCount),
  };
}

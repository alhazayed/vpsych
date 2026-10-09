/**
 * Maps a failed POST /api/sessions response to a localized message key under
 * `session.start`. Server error strings are English and may be generic, so the
 * learner-facing copy is chosen by the response `code` (when the route sends
 * one) or by status, instead of echoing them.
 */
export type SessionStartErrorKey =
  | "signedOut"
  | "rateLimited"
  | "patientUnavailable"
  | "ladderLocked"
  | "ladderUnavailable"
  | "ladderPatientOnly"
  | "treatmentPlanRequired"
  | "courseLengthReached"
  | "testNotAssigned"
  | "testClosed"
  | "testSessionActive"
  | "testSessionsUsed"
  | "testUnavailable"
  | "failed";

const CODE_KEYS: Record<string, SessionStartErrorKey> = {
  ladder_level_locked: "ladderLocked",
  ladder_unavailable: "ladderUnavailable",
  ladder_invalid: "ladderUnavailable",
  ladder_attempt_failed: "failed",
  ladder_patient_only: "ladderPatientOnly",
  treatment_plan_required: "treatmentPlanRequired",
  course_length_reached: "courseLengthReached",
  skill_test_not_assigned: "testNotAssigned",
  skill_test_closed: "testClosed",
  skill_test_session_active: "testSessionActive",
  skill_test_sessions_used: "testSessionsUsed",
  skill_test_case_mismatch: "testUnavailable",
  skill_test_unavailable: "testUnavailable",
};

export function sessionStartErrorKey(
  status: number,
  code?: string | null,
): SessionStartErrorKey {
  if (code && Object.hasOwn(CODE_KEYS, code)) return CODE_KEYS[code];
  if (status === 401) return "signedOut";
  if (status === 429) return "rateLimited";
  if (status === 404 || status === 409 || status === 422) return "patientUnavailable";
  return "failed";
}

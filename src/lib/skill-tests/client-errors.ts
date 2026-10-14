/**
 * Maps failed skill-test API responses to localized message keys. The routes
 * answer in English; the supervisor screens choose their EN/AR copy by the
 * response `code` (or status) instead of echoing the server text.
 *
 * Client components import this file directly: the `@/lib/skill-tests` barrel
 * also exports server-only modules (persist, seal).
 */
import type { SkillTestValidationError } from "./validation";

/** Keys under `skillTests.form.errors`. */
export type SkillTestFormErrorKey =
  | "signedOut"
  | "forbidden"
  | "rateLimited"
  | "traineeRequired"
  | "patientRequired"
  | "titleInvalid"
  | "languageInvalid"
  | "disorderInvalid"
  | "comorbidityInvalid"
  | "difficultyInvalid"
  | "severityInvalid"
  | "sessionsInvalid"
  | "instructionsTooLong"
  | "dueDateInvalid"
  | "ladderUnavailable"
  | "ladderPatientOnly"
  | "patientIncompatible"
  | "testUnavailable"
  | "failed";

const VALIDATION_KEYS: Record<SkillTestValidationError, SkillTestFormErrorKey> = {
  trainee_required: "traineeRequired",
  patient_required: "patientRequired",
  title_invalid: "titleInvalid",
  language_invalid: "languageInvalid",
  disorder_invalid: "disorderInvalid",
  comorbidity_invalid: "comorbidityInvalid",
  difficulty_invalid: "difficultyInvalid",
  severity_invalid: "severityInvalid",
  sessions_invalid: "sessionsInvalid",
  instructions_too_long: "instructionsTooLong",
  due_date_invalid: "dueDateInvalid",
};

const FORM_CODE_KEYS: Record<string, SkillTestFormErrorKey> = {
  ...VALIDATION_KEYS,
  ladder_unavailable: "ladderUnavailable",
  ladder_patient_only: "ladderPatientOnly",
  patient_incompatible: "patientIncompatible",
  skill_test_unavailable: "testUnavailable",
};

/** Every code POST /api/skill-tests can send. */
export const SKILL_TEST_FORM_CODES = Object.keys(FORM_CODE_KEYS);

export function skillTestFormErrorKey(
  status: number,
  code?: string | null,
): SkillTestFormErrorKey {
  if (code && Object.hasOwn(FORM_CODE_KEYS, code)) return FORM_CODE_KEYS[code];
  if (status === 401) return "signedOut";
  if (status === 403) return "forbidden";
  if (status === 429) return "rateLimited";
  return "failed";
}

/** Keys under `skillTests.supervise`. */
export type SkillTestCancelErrorKey =
  | "cancelClosed"
  | "cancelNotFound"
  | "cancelForbidden"
  | "rateLimited"
  | "cancelFailed";

export function skillTestCancelErrorKey(
  status: number,
  code?: string | null,
): SkillTestCancelErrorKey {
  if (code === "skill_test_closed" || status === 409) return "cancelClosed";
  if (status === 404) return "cancelNotFound";
  if (status === 401 || status === 403) return "cancelForbidden";
  if (status === 429) return "rateLimited";
  return "cancelFailed";
}

/** Keys under `skillTests.admin`. */
export type SupervisorRoleErrorKey =
  | "mfaRequired"
  | "notApplied"
  | "rateLimited"
  | "changeFailed";

export function supervisorRoleErrorKey(
  status: number,
  code?: string | null,
): SupervisorRoleErrorKey {
  if (code === "MFA_REQUIRED") return "mfaRequired";
  if (code === "SUPERVISOR_NOT_UPDATED" || status === 409) return "notApplied";
  if (status === 429) return "rateLimited";
  return "changeFailed";
}

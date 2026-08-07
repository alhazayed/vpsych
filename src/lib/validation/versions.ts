/**
 * Stage 8 version locks and ownership invariants.
 */

import {
  VALIDATION_ALGORITHM_VERSION,
  VALIDATION_FRAMEWORK_VERSION,
  VALIDATION_VERSION,
  type ValidationVersionLock,
} from "@/lib/validation/types";

export {
  VALIDATION_ALGORITHM_VERSION,
  VALIDATION_FRAMEWORK_VERSION,
  VALIDATION_VERSION,
};

/** Forbidden write targets — architecture tests assert these strings stay present. */
export const VALIDATION_FORBIDDEN_WRITES = [
  "clinical_snapshot",
  "case_memory",
  "patient_long_term_memory",
  "DecisionPlan",
  "patient prompt",
] as const;

export const VALIDATION_OWNERSHIP_RULE =
  "Validation observes only. Never owns patient state. Never changes cognition. Never modifies memory.";

export function buildValidationVersionLock(opts?: {
  assessment_schema_version?: string | null;
  prompt_version?: string | null;
  computed_at?: string;
}): ValidationVersionLock {
  return {
    validation_version: VALIDATION_VERSION,
    framework_version: VALIDATION_FRAMEWORK_VERSION,
    algorithm_version: VALIDATION_ALGORITHM_VERSION,
    assessment_schema_version: opts?.assessment_schema_version ?? null,
    prompt_version: opts?.prompt_version ?? null,
    computed_at: opts?.computed_at ?? new Date().toISOString(),
  };
}

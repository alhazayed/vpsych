/**
 * Stage 9 version locks and ownership invariants.
 */

import {
  SUPERVISOR_FRAMEWORK_VERSION,
  SUPERVISOR_VERSION,
  type SupervisorVersionLock,
} from "@/lib/supervisor/types";

export { SUPERVISOR_FRAMEWORK_VERSION, SUPERVISOR_VERSION };

/** Forbidden write targets — architecture tests assert these strings stay present. */
export const SUPERVISOR_FORBIDDEN_WRITES = [
  "clinical_snapshot",
  "case_memory",
  "patient_long_term_memory",
  "DecisionPlan",
  "patient prompt",
  "Emotion",
  "Adaptation",
  "Case Engine",
  "Clinical Intelligence",
  "Validation",
] as const;

export const SUPERVISOR_OWNERSHIP_RULE =
  "Supervisor observes only. Evaluates therapists — not patients. Never owns Patient, Memory, Emotion, Adaptation, Case Engine, Clinical Intelligence, or Validation. Never changes patient state or cognition.";

export function buildSupervisorVersionLock(opts?: {
  computed_at?: string;
}): SupervisorVersionLock {
  return {
    supervisor_version: SUPERVISOR_VERSION,
    framework_version: SUPERVISOR_FRAMEWORK_VERSION,
    computed_at: opts?.computed_at ?? new Date().toISOString(),
  };
}

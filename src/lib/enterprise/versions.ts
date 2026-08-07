/**
 * Stage 10 version locks and ownership invariants.
 */

import {
  ENTERPRISE_CERT_ENGINE_VERSION,
  ENTERPRISE_COURSE_ENGINE_VERSION,
  ENTERPRISE_RBAC_VERSION,
  ENTERPRISE_VERSION,
  type EnterpriseVersionLock,
} from "@/lib/enterprise/types";

export {
  ENTERPRISE_VERSION,
  ENTERPRISE_RBAC_VERSION,
  ENTERPRISE_COURSE_ENGINE_VERSION,
  ENTERPRISE_CERT_ENGINE_VERSION,
};

/** Forbidden write targets — architecture tests assert these strings stay present. */
export const ENTERPRISE_FORBIDDEN_WRITES = [
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
  "Supervisor patient writes",
] as const;

export const ENTERPRISE_OWNERSHIP_RULE =
  "Enterprise owns tenancy, RBAC, org hierarchy, courses, org certificates, analytics dashboards, research study metadata, webhooks, and observability. Never owns Patient, Memory, Emotion, Adaptation, Case Engine, Clinical Intelligence, Validation scoring, or Supervisor skill evaluation. Never changes patient state or cognition. Never exposes session_reports to therapists.";

export function buildEnterpriseVersionLock(opts?: {
  computed_at?: string;
}): EnterpriseVersionLock {
  return {
    enterprise_version: ENTERPRISE_VERSION,
    rbac_version: ENTERPRISE_RBAC_VERSION,
    course_engine_version: ENTERPRISE_COURSE_ENGINE_VERSION,
    cert_engine_version: ENTERPRISE_CERT_ENGINE_VERSION,
    computed_at: opts?.computed_at ?? new Date().toISOString(),
  };
}

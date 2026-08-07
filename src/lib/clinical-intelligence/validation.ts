/**
 * Validation for Clinical Intelligence runtime objects.
 * Hand-written validators (match local engine style — not Zod).
 */

import type {
  AutomaticThought,
  BeliefSystem,
  ClinicalIntelligenceMindState,
  CoreBelief,
  CoreSchema,
  CoreValue,
  InsightBand,
  MentalStatusExam,
  PatientDecisionPlan,
  PatientFormulation,
  ProtectiveFactor,
  RecoveryStage,
  TherapyResponseProfile,
} from "@/lib/clinical-intelligence/types";
import { FORMULATION_VERSION, MSE_VERSION, THERAPY_RESPONSE_VERSION } from "@/lib/clinical-intelligence/types";
import { clamp01to100 } from "@/lib/clinical-intelligence/clamp";

export type CiValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type CiValidationResult =
  | { ok: true }
  | { ok: false; issues: CiValidationIssue[] };

const INSIGHT_BANDS: InsightBand[] = [
  "absent",
  "poor",
  "partial",
  "good",
  "intellectual_only",
];

const RECOVERY_STAGES: RecoveryStage[] = [
  "intake",
  "early_alliance",
  "engaged_work",
  "partial_response",
  "plateau",
  "relapse_risk",
  "relapse",
  "dropout_risk",
  "dropped_out",
  "re_intake",
  "recovery",
  "maintenance",
];

function issue(
  code: string,
  message: string,
  path?: string,
): CiValidationIssue {
  return { code, message, path };
}

export function isInsightBand(v: unknown): v is InsightBand {
  return typeof v === "string" && (INSIGHT_BANDS as string[]).includes(v);
}

export function isRecoveryStage(v: unknown): v is RecoveryStage {
  return typeof v === "string" && (RECOVERY_STAGES as string[]).includes(v);
}

export function validateCoreBelief(
  b: unknown,
  path = "core_belief",
): CiValidationIssue[] {
  if (!b || typeof b !== "object") {
    return [issue("belief_not_object", "Core belief must be an object", path)];
  }
  const belief = b as Partial<CoreBelief>;
  const issues: CiValidationIssue[] = [];
  if (!belief.id || typeof belief.id !== "string") {
    issues.push(issue("belief_id", "id required", `${path}.id`));
  }
  if (!belief.statement || typeof belief.statement !== "string") {
    issues.push(issue("belief_statement", "statement required", `${path}.statement`));
  }
  if (
    belief.strength !== undefined &&
    (typeof belief.strength !== "number" ||
      belief.strength < 0 ||
      belief.strength > 100)
  ) {
    issues.push(issue("belief_strength", "strength must be 0–100", `${path}.strength`));
  }
  return issues;
}

export function validateBeliefSystem(v: unknown): CiValidationResult {
  if (!v || typeof v !== "object") {
    return { ok: false, issues: [issue("belief_system", "BeliefSystem required")] };
  }
  const sys = v as BeliefSystem;
  const issues: CiValidationIssue[] = [];
  if (sys.version !== FORMULATION_VERSION) {
    issues.push(issue("belief_version", `version must be ${FORMULATION_VERSION}`));
  }
  if (!Array.isArray(sys.core_beliefs)) {
    issues.push(issue("core_beliefs", "core_beliefs must be an array"));
  } else {
    sys.core_beliefs.forEach((b, i) => {
      issues.push(...validateCoreBelief(b, `core_beliefs[${i}]`));
    });
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

export function validateProtectiveFactor(v: unknown, path = "protective"): CiValidationIssue[] {
  if (!v || typeof v !== "object") {
    return [issue("protective_not_object", "ProtectiveFactor must be an object", path)];
  }
  const p = v as Partial<ProtectiveFactor>;
  const issues: CiValidationIssue[] = [];
  if (!p.id || typeof p.id !== "string") {
    issues.push(issue("protective_id", "id required", `${path}.id`));
  }
  if (!p.label || typeof p.label !== "string") {
    issues.push(issue("protective_label", "label required", `${path}.label`));
  }
  if (!p.category || typeof p.category !== "string") {
    issues.push(issue("protective_category", "category required", `${path}.category`));
  }
  return issues;
}

export function validateMentalStatusExam(v: unknown): CiValidationResult {
  if (!v || typeof v !== "object") {
    return { ok: false, issues: [issue("mse", "MentalStatusExam required")] };
  }
  const mse = v as MentalStatusExam;
  const issues: CiValidationIssue[] = [];
  if (mse.version !== MSE_VERSION) {
    issues.push(issue("mse_version", `version must be ${MSE_VERSION}`));
  }
  if (!isInsightBand(mse.insight)) {
    issues.push(issue("mse_insight", "insight band invalid", "insight"));
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

export function validatePatientFormulation(v: unknown): CiValidationResult {
  if (!v || typeof v !== "object") {
    return { ok: false, issues: [issue("formulation", "PatientFormulation required")] };
  }
  const f = v as PatientFormulation;
  const issues: CiValidationIssue[] = [];
  if (f.version !== FORMULATION_VERSION) {
    issues.push(issue("formulation_version", `version must be ${FORMULATION_VERSION}`));
  }
  const bel = validateBeliefSystem(f.belief_system);
  if (!bel.ok) issues.push(...bel.issues);
  if (!Array.isArray(f.values)) {
    issues.push(issue("values", "values must be an array"));
  } else {
    f.values.forEach((val: CoreValue, i: number) => {
      if (!val?.id || !val?.label) {
        issues.push(issue("value_fields", "value id/label required", `values[${i}]`));
      }
    });
  }
  if (!Array.isArray(f.schemas)) {
    issues.push(issue("schemas", "schemas must be an array"));
  } else {
    f.schemas.forEach((s: CoreSchema, i: number) => {
      if (!s?.id || !s?.if_condition || !s?.then_pattern) {
        issues.push(issue("schema_fields", "schema incomplete", `schemas[${i}]`));
      }
    });
  }
  if (!Array.isArray(f.distortions)) {
    issues.push(issue("distortions", "distortions must be an array"));
  }
  if (!Array.isArray(f.automatic_thoughts_seed)) {
    issues.push(issue("ats", "automatic_thoughts_seed must be an array"));
  } else {
    f.automatic_thoughts_seed.forEach((at: AutomaticThought, i: number) => {
      if (!at?.id || !at?.content) {
        issues.push(issue("at_fields", "AT id/content required", `automatic_thoughts_seed[${i}]`));
      }
    });
  }
  // patient_goals must never be confused with session_goals at the type level —
  // we only check shape here.
  if (f.patient_goals !== undefined && !Array.isArray(f.patient_goals)) {
    issues.push(issue("patient_goals", "patient_goals must be string[]"));
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

export function validateTherapyResponseProfile(v: unknown): CiValidationResult {
  if (!v || typeof v !== "object") {
    return { ok: false, issues: [issue("therapy_profile", "TherapyResponseProfile required")] };
  }
  const p = v as TherapyResponseProfile;
  const issues: CiValidationIssue[] = [];
  if (p.version !== THERAPY_RESPONSE_VERSION) {
    issues.push(issue("therapy_version", `version must be ${THERAPY_RESPONSE_VERSION}`));
  }
  if (!p.modality || typeof p.modality !== "string") {
    issues.push(issue("modality", "modality required"));
  }
  if (!Array.isArray(p.engages_with)) {
    issues.push(issue("engages_with", "engages_with must be string[]"));
  }
  if (!Array.isArray(p.resists)) {
    issues.push(issue("resists", "resists must be string[]"));
  }
  if (typeof p.alliance_cue !== "string") {
    issues.push(issue("alliance_cue", "alliance_cue required"));
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

export function validatePatientDecisionPlan(v: unknown): CiValidationResult {
  if (!v || typeof v !== "object") {
    return { ok: false, issues: [issue("decision_plan", "PatientDecisionPlan required")] };
  }
  const p = v as PatientDecisionPlan;
  const issues: CiValidationIssue[] = [];
  if (p.version !== 1) {
    issues.push(issue("decision_version", "version must be 1"));
  }
  const gates = ["withhold", "deflect", "partial", "open"];
  if (!gates.includes(p.disclosure)) {
    issues.push(issue("disclosure", "invalid disclosure gate"));
  }
  const speaks = ["llm", "direct", "silence_hold"];
  if (!speaks.includes(p.speak)) {
    issues.push(issue("speak", "invalid speak mode"));
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

export function validateMindState(v: unknown): CiValidationResult {
  if (!v || typeof v !== "object") {
    return { ok: false, issues: [issue("mind_state", "ClinicalIntelligenceMindState required")] };
  }
  const m = v as ClinicalIntelligenceMindState;
  const issues: CiValidationIssue[] = [];
  if (m.version !== 1) {
    issues.push(issue("mind_version", "version must be 1"));
  }
  if (!m.recovery || !isRecoveryStage(m.recovery.stage)) {
    issues.push(issue("recovery_stage", "invalid recovery stage"));
  }
  if (m.adherence) {
    const o = clamp01to100(m.adherence.overall);
    if (o !== m.adherence.overall && Number.isFinite(m.adherence.overall) === false) {
      issues.push(issue("adherence_overall", "overall must be 0–100"));
    }
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}

export { INSIGHT_BANDS, RECOVERY_STAGES };

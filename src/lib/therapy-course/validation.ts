/**
 * Treatment plan validation — hand-written, matches the engine validators.
 */

import { FIVE_PS, type FivePsFormulation, type TreatmentPlan } from "@/lib/types";
import { MAX_PLANNED_SESSIONS } from "./gate";

export const PLAN_LIMITS = {
  formulationMin: 20,
  formulationMax: 2000,
  goalMin: 3,
  goalMax: 300,
  goalsMin: 1,
  goalsMax: 6,
  interventionsMin: 10,
  interventionsMax: 2000,
  expectationsMin: 10,
  expectationsMax: 1500,
  riskMin: 10,
  riskMax: 1500,
  fivePMin: 3,
  fivePMax: 600,
} as const;

export type PlanFieldError =
  | "formulation"
  | "goals"
  | "interventions"
  | "expected_sessions"
  | "patient_expectations"
  | "risk_formulation"
  | "five_ps";

export type PlanValidationResult =
  | { ok: true; plan: TreatmentPlan }
  | { ok: false; field: PlanFieldError };

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function within(s: string, min: number, max: number): boolean {
  return s.length >= min && s.length <= max;
}

/**
 * Validate an untrusted plan body. `minSessions` is the smallest course length
 * allowed now (see `minPlannedSessions`).
 */
export function validateTreatmentPlan(
  body: unknown,
  opts: { minSessions: number },
): PlanValidationResult {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;

  const formulation = text(b.formulation);
  if (!within(formulation, PLAN_LIMITS.formulationMin, PLAN_LIMITS.formulationMax)) {
    return { ok: false, field: "formulation" };
  }

  const rawGoals = Array.isArray(b.goals) ? b.goals : [];
  const goals = rawGoals.map(text).filter((g) => g.length > 0);
  if (
    goals.length < PLAN_LIMITS.goalsMin ||
    goals.length > PLAN_LIMITS.goalsMax ||
    goals.some((g) => !within(g, PLAN_LIMITS.goalMin, PLAN_LIMITS.goalMax))
  ) {
    return { ok: false, field: "goals" };
  }

  const interventions = text(b.interventions);
  if (
    !within(interventions, PLAN_LIMITS.interventionsMin, PLAN_LIMITS.interventionsMax)
  ) {
    return { ok: false, field: "interventions" };
  }

  const expected =
    typeof b.expected_sessions === "number"
      ? b.expected_sessions
      : Number(b.expected_sessions);
  if (
    !Number.isInteger(expected) ||
    expected < opts.minSessions ||
    expected > MAX_PLANNED_SESSIONS
  ) {
    return { ok: false, field: "expected_sessions" };
  }

  const patientExpectations = text(b.patient_expectations);
  if (
    !within(
      patientExpectations,
      PLAN_LIMITS.expectationsMin,
      PLAN_LIMITS.expectationsMax,
    )
  ) {
    return { ok: false, field: "patient_expectations" };
  }

  const riskFormulation = text(b.risk_formulation);
  if (!within(riskFormulation, PLAN_LIMITS.riskMin, PLAN_LIMITS.riskMax)) {
    return { ok: false, field: "risk_formulation" };
  }

  const fivePs = validateFivePs(b.five_ps);
  if (!fivePs) {
    return { ok: false, field: "five_ps" };
  }

  return {
    ok: true,
    plan: {
      formulation,
      goals,
      interventions,
      expected_sessions: expected,
      patient_expectations: patientExpectations,
      risk_formulation: riskFormulation,
      five_ps: fivePs,
    },
  };
}

/** Every P is required: a formulation with a blank P is not a 5 Ps formulation. */
function validateFivePs(v: unknown): FivePsFormulation | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const raw = v as Record<string, unknown>;
  const out = {} as FivePsFormulation;
  for (const key of FIVE_PS) {
    const value = text(raw[key]);
    if (!within(value, PLAN_LIMITS.fivePMin, PLAN_LIMITS.fivePMax)) return null;
    out[key] = value;
  }
  return out;
}

/** Narrow a stored 5 Ps value (null when absent or malformed). */
export function asFivePs(v: unknown): FivePsFormulation | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const raw = v as Record<string, unknown>;
  const out = {} as FivePsFormulation;
  for (const key of FIVE_PS) {
    const value = raw[key];
    if (typeof value !== "string") return null;
    out[key] = value;
  }
  return out;
}

/** Narrow a stored jsonb value to a plan (null when malformed). */
export function asTreatmentPlan(v: unknown): TreatmentPlan | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Partial<TreatmentPlan>;
  if (
    typeof p.formulation !== "string" ||
    !Array.isArray(p.goals) ||
    typeof p.interventions !== "string" ||
    typeof p.expected_sessions !== "number" ||
    typeof p.patient_expectations !== "string"
  ) {
    return null;
  }
  return {
    formulation: p.formulation,
    goals: p.goals.filter((g): g is string => typeof g === "string"),
    interventions: p.interventions,
    expected_sessions: p.expected_sessions,
    patient_expectations: p.patient_expectations,
    risk_formulation:
      typeof p.risk_formulation === "string" ? p.risk_formulation : "",
    five_ps: asFivePs(p.five_ps),
  };
}

/**
 * Patient Mind Fidelity Index (PMFI) v1.0 — Mission 21.
 */

export const PMFI_VERSION = "1.0.0";

export type PmfiDimensionId =
  | "psychological_consistency"
  | "relationship_continuity"
  | "behavior_realism"
  | "defense_realism"
  | "disclosure_realism"
  | "therapy_realism"
  | "session_continuity"
  | "emotional_continuity"
  | "longitudinal_realism"
  | "patient_authenticity";

export type PmfiWeightEntry = {
  id: PmfiDimensionId;
  weight: number;
  rationale: string;
};

export const PMFI_WEIGHT_MATRIX: PmfiWeightEntry[] = [
  {
    id: "psychological_consistency",
    weight: 0.14,
    rationale: "Hidden state drives behaviour without contradiction",
  },
  {
    id: "relationship_continuity",
    weight: 0.12,
    rationale: "Trust/alliance evolve gradually across turns/sessions",
  },
  {
    id: "behavior_realism",
    weight: 0.12,
    rationale: "Disorder-specific dynamics over time",
  },
  {
    id: "defense_realism",
    weight: 0.1,
    rationale: "Defenses fit diagnosis, stress, and alliance",
  },
  {
    id: "disclosure_realism",
    weight: 0.12,
    rationale: "Continuous thresholds, not binary dumps",
  },
  {
    id: "therapy_realism",
    weight: 0.08,
    rationale: "Therapist effects change patient state appropriately",
  },
  {
    id: "session_continuity",
    weight: 0.08,
    rationale: "Session arc phases progress naturally",
  },
  {
    id: "emotional_continuity",
    weight: 0.1,
    rationale: "Affect persists; no instant flips",
  },
  {
    id: "longitudinal_realism",
    weight: 0.07,
    rationale: "Life events and multi-session change",
  },
  {
    id: "patient_authenticity",
    weight: 0.07,
    rationale: "Expression layer constrained by mind state",
  },
];

export function assertPmfiWeightMatrixValid(): void {
  const sum = PMFI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`PMFI weight matrix sums to ${sum}, expected 1.0`);
  }
}

export function pmfiWeightMap(): Record<PmfiDimensionId, number> {
  return Object.fromEntries(
    PMFI_WEIGHT_MATRIX.map((e) => [e.id, e.weight]),
  ) as Record<PmfiDimensionId, number>;
}

assertPmfiWeightMatrixValid();

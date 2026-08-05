/**
 * Human Conversation Fidelity Index (HCFI) v1.0 — weight matrix.
 *
 * Mission 20 (HCTF). Scores how indistinguishable AI patient dialogue is from
 * a well-trained standardized patient across language, emotion, clinic, culture,
 * voice, alliance, flow, consistency, education, and immersion.
 * Do not alter weights without bumping HCFI_VERSION.
 */

export const HCFI_VERSION = "1.0.0";

export type HcfiDimensionId =
  | "natural_language"
  | "emotional_authenticity"
  | "clinical_authenticity"
  | "cultural_authenticity"
  | "voice_realism"
  | "therapeutic_alliance"
  | "conversational_flow"
  | "patient_consistency"
  | "educational_utility"
  | "immersion";

export type HcfiWeightEntry = {
  id: HcfiDimensionId;
  weight: number;
  rationale: string;
};

/** Canonical weight matrix — sum MUST equal 1.0 within 1e-9. */
export const HCFI_WEIGHT_MATRIX: HcfiWeightEntry[] = [
  {
    id: "natural_language",
    weight: 0.14,
    rationale: "Spoken, uneven, non-AI patient language",
  },
  {
    id: "emotional_authenticity",
    weight: 0.12,
    rationale: "Affect matches diagnosis, severity, and culture",
  },
  {
    id: "clinical_authenticity",
    weight: 0.14,
    rationale: "Speech pattern fits syndrome (not symptom laundry list)",
  },
  {
    id: "cultural_authenticity",
    weight: 0.1,
    rationale: "Dialect, education, and cultural frame sound native",
  },
  {
    id: "voice_realism",
    weight: 0.08,
    rationale: "TTS pacing/stability reinforce the clinical presentation",
  },
  {
    id: "therapeutic_alliance",
    weight: 0.1,
    rationale: "Disclosure and trust shift with therapist skill",
  },
  {
    id: "conversational_flow",
    weight: 0.1,
    rationale: "Natural turn length, hesitations, topic shifts",
  },
  {
    id: "patient_consistency",
    weight: 0.08,
    rationale: "Identity and facts hold; human inconsistency allowed",
  },
  {
    id: "educational_utility",
    weight: 0.08,
    rationale: "Turns create openings for MSE, risk, differential, alliance",
  },
  {
    id: "immersion",
    weight: 0.06,
    rationale: "Absence of meta/AI leakage; presence of lived detail",
  },
];

export function assertHcfiWeightMatrixValid(): void {
  const sum = HCFI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`HCFI weight matrix sums to ${sum}, expected 1.0`);
  }
  const ids = new Set(HCFI_WEIGHT_MATRIX.map((e) => e.id));
  if (ids.size !== HCFI_WEIGHT_MATRIX.length) {
    throw new Error("Duplicate HCFI dimension ids in weight matrix");
  }
}

export function hcfiWeightMap(): Record<HcfiDimensionId, number> {
  return Object.fromEntries(
    HCFI_WEIGHT_MATRIX.map((e) => [e.id, e.weight]),
  ) as Record<HcfiDimensionId, number>;
}

assertHcfiWeightMatrixValid();

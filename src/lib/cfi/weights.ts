/**
 * Clinical Fidelity Index (CFI) v1.0 — weight matrix.
 *
 * Weights sum to 1.0. Domains are ordered by clinical risk/nosology priority
 * as agreed by the international clinical review board (Mission CFI).
 * Do not alter weights without bumping CFI_VERSION.
 */

export const CFI_VERSION = "1.0.0";

export type CfiDimensionId =
  | "dsm5_diagnostic_accuracy"
  | "icd11_consistency"
  | "symptom_fidelity"
  | "severity_fidelity"
  | "timeline_consistency"
  | "comorbidity_consistency"
  | "differential_consistency"
  | "mse_realism"
  | "medication_history"
  | "risk_assessment"
  | "protective_factors"
  | "speech_realism"
  | "behavior_realism"
  | "emotional_realism"
  | "cultural_realism"
  | "language_realism"
  | "voice_realism"
  | "memory_consistency"
  | "disclosure_consistency"
  | "prompt_consistency";

export type CfiWeightEntry = {
  id: CfiDimensionId;
  weight: number;
  rationale: string;
};

/** Canonical weight matrix — sum MUST equal 1.0 within 1e-9. */
export const CFI_WEIGHT_MATRIX: CfiWeightEntry[] = [
  {
    id: "dsm5_diagnostic_accuracy",
    weight: 0.12,
    rationale: "DSM-5-TR criteria coding is the primary nosological anchor",
  },
  {
    id: "icd11_consistency",
    weight: 0.1,
    rationale: "ICD-11 international interoperability and coding fidelity",
  },
  {
    id: "symptom_fidelity",
    weight: 0.1,
    rationale: "Symptom profile must match intended disorder domains",
  },
  {
    id: "severity_fidelity",
    weight: 0.05,
    rationale: "Severity must match package/template intent",
  },
  {
    id: "timeline_consistency",
    weight: 0.05,
    rationale: "Onset/course must be clinically possible for the disorder",
  },
  {
    id: "comorbidity_consistency",
    weight: 0.04,
    rationale: "Comorbidities must obey compatibility rules",
  },
  {
    id: "differential_consistency",
    weight: 0.05,
    rationale: "Differentials/rule-outs present for educational fidelity",
  },
  {
    id: "mse_realism",
    weight: 0.08,
    rationale: "MSE cues (insight/judgment/speech/thought) support realism",
  },
  {
    id: "medication_history",
    weight: 0.03,
    rationale: "Medication cues must not invent impossible regimens",
  },
  {
    id: "risk_assessment",
    weight: 0.08,
    rationale: "SI/self-harm/harm-to-others defaults must be explicit and coherent",
  },
  {
    id: "protective_factors",
    weight: 0.02,
    rationale: "Protective/contextual supports balance risk portrayal",
  },
  {
    id: "speech_realism",
    weight: 0.03,
    rationale: "Speech style cues consistent with diagnosis, not caricature",
  },
  {
    id: "behavior_realism",
    weight: 0.03,
    rationale: "Behavioural cues consistent with presentation",
  },
  {
    id: "emotional_realism",
    weight: 0.03,
    rationale: "Affect/emotion portrayal matches severity and disorder",
  },
  {
    id: "cultural_realism",
    weight: 0.03,
    rationale: "Culture does not rewrite diagnosis; cultural cues present",
  },
  {
    id: "language_realism",
    weight: 0.03,
    rationale: "Locale/language module consistent with session language",
  },
  {
    id: "voice_realism",
    weight: 0.02,
    rationale: "Voice casting present when voice-enabled sessions run",
  },
  {
    id: "memory_consistency",
    weight: 0.03,
    rationale: "Case-isolated memory prevents cross-session contamination",
  },
  {
    id: "disclosure_consistency",
    weight: 0.04,
    rationale: "Disclosure rules align with difficulty and risk topics",
  },
  {
    id: "prompt_consistency",
    weight: 0.04,
    rationale: "Prompt version lock and no identity/system leakage patterns",
  },
];

export function assertWeightMatrixValid(): void {
  const sum = CFI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`CFI weight matrix sums to ${sum}, expected 1.0`);
  }
  const ids = new Set(CFI_WEIGHT_MATRIX.map((e) => e.id));
  if (ids.size !== CFI_WEIGHT_MATRIX.length) {
    throw new Error("Duplicate CFI dimension ids in weight matrix");
  }
}

export function weightMap(): Record<CfiDimensionId, number> {
  return Object.fromEntries(
    CFI_WEIGHT_MATRIX.map((e) => [e.id, e.weight]),
  ) as Record<CfiDimensionId, number>;
}

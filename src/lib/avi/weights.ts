/**
 * Assessment Validity Index (AVI) v1.0 — weight matrix.
 *
 * Weights sum to 1.0. Domains prioritise whether VPsych evaluates the
 * competencies it claims to evaluate (Mission AVI).
 * Do not alter weights without bumping AVI_VERSION.
 */

export const AVI_VERSION = "1.0.0";

export type AviDimensionId =
  | "content_validity"
  | "construct_validity"
  | "face_validity"
  | "criterion_validity"
  | "internal_consistency"
  | "reliability"
  | "competency_alignment"
  | "clinical_relevance"
  | "educational_relevance"
  | "bias"
  | "difficulty_discrimination"
  | "competency_discrimination"
  | "repeatability"
  | "explainability";

export type AviWeightEntry = {
  id: AviDimensionId;
  weight: number;
  rationale: string;
};

/** Canonical weight matrix — sum MUST equal 1.0 within 1e-9. */
export const AVI_WEIGHT_MATRIX: AviWeightEntry[] = [
  {
    id: "content_validity",
    weight: 0.1,
    rationale: "Rubric covers the claimed competency domain (OSCE-style content)",
  },
  {
    id: "construct_validity",
    weight: 0.1,
    rationale: "Scores behave as if measuring the intended construct (α, discrimination)",
  },
  {
    id: "face_validity",
    weight: 0.06,
    rationale: "Assessment looks like a credible clinical skills examination",
  },
  {
    id: "criterion_validity",
    weight: 0.1,
    rationale: "Agreement with an external/reference criterion (or disclosed absence)",
  },
  {
    id: "internal_consistency",
    weight: 0.08,
    rationale: "Cronbach α / item coherence of the scoring instrument",
  },
  {
    id: "reliability",
    weight: 0.08,
    rationale: "Test–retest / stability of overall scores under repeated assessment",
  },
  {
    id: "competency_alignment",
    weight: 0.08,
    rationale: "Rubric items map to ACE/CGE competency graph nodes",
  },
  {
    id: "clinical_relevance",
    weight: 0.07,
    rationale: "Dimensions include safety, assessment, alliance — clinically meaningful",
  },
  {
    id: "educational_relevance",
    weight: 0.07,
    rationale: "Feedback and narrative support learning, not score dumping alone",
  },
  {
    id: "bias",
    weight: 0.06,
    rationale: "Language/demographic fairness controls within educational tolerance",
  },
  {
    id: "difficulty_discrimination",
    weight: 0.05,
    rationale: "Scores separate easy vs hard cases / learner levels",
  },
  {
    id: "competency_discrimination",
    weight: 0.05,
    rationale: "Item–total discrimination distinguishes strong vs weak competency",
  },
  {
    id: "repeatability",
    weight: 0.05,
    rationale: "Low variance across repeated assessments of the same case",
  },
  {
    id: "explainability",
    weight: 0.05,
    rationale: "Scores are accompanied by feedback, narrative, and provenance",
  },
];

export function assertWeightMatrixValid(): void {
  const sum = AVI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`AVI weight matrix sums to ${sum}, expected 1.0`);
  }
  const ids = new Set(AVI_WEIGHT_MATRIX.map((e) => e.id));
  if (ids.size !== AVI_WEIGHT_MATRIX.length) {
    throw new Error("Duplicate AVI dimension ids in weight matrix");
  }
}

export function weightMap(): Record<AviDimensionId, number> {
  return Object.fromEntries(
    AVI_WEIGHT_MATRIX.map((e) => [e.id, e.weight]),
  ) as Record<AviDimensionId, number>;
}

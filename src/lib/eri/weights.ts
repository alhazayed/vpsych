/**
 * Educational Reliability Index (ERI) v1.0 — weight matrix.
 *
 * Weights sum to 1.0. Domains prioritise CBME / OSCE educational usefulness
 * as agreed by the educational review board (Mission ERI).
 * Do not alter weights without bumping ERI_VERSION.
 */

export const ERI_VERSION = "1.0.0";

export type EriDimensionId =
  | "competency_scoring_consistency"
  | "feedback_usefulness"
  | "feedback_specificity"
  | "actionability"
  | "supervisor_comments"
  | "reflection_quality"
  | "learning_objective_alignment"
  | "clinical_reasoning_quality"
  | "remediation_quality"
  | "difficulty_calibration"
  | "inter_session_consistency"
  | "inter_rater_agreement"
  | "longitudinal_stability"
  | "assessment_fairness"
  | "language_parity";

export type EriWeightEntry = {
  id: EriDimensionId;
  weight: number;
  rationale: string;
};

/** Canonical weight matrix — sum MUST equal 1.0 within 1e-9. */
export const ERI_WEIGHT_MATRIX: EriWeightEntry[] = [
  {
    id: "competency_scoring_consistency",
    weight: 0.12,
    rationale: "Rubric items must be complete, weighted, and internally coherent",
  },
  {
    id: "feedback_usefulness",
    weight: 0.08,
    rationale: "Feedback must help learners improve, not merely label performance",
  },
  {
    id: "feedback_specificity",
    weight: 0.07,
    rationale: "Item-level feedback must be concrete and criterion-referenced",
  },
  {
    id: "actionability",
    weight: 0.07,
    rationale: "Improvement plans and next cases must be actionable",
  },
  {
    id: "supervisor_comments",
    weight: 0.06,
    rationale: "Supervisor-style narrative must summarise strengths and growth areas",
  },
  {
    id: "reflection_quality",
    weight: 0.05,
    rationale: "Reflective prompts support deliberate practice and metacognition",
  },
  {
    id: "learning_objective_alignment",
    weight: 0.08,
    rationale: "Assessment must map to declared learning objectives / competencies",
  },
  {
    id: "clinical_reasoning_quality",
    weight: 0.08,
    rationale: "Narrative must evidence clinical reasoning, not score dumping",
  },
  {
    id: "remediation_quality",
    weight: 0.07,
    rationale: "Missed opportunities and remediation paths must be explicit",
  },
  {
    id: "difficulty_calibration",
    weight: 0.06,
    rationale: "Difficulty must match learner level and case intent",
  },
  {
    id: "inter_session_consistency",
    weight: 0.06,
    rationale: "Similar performances should not swing wildly across sessions",
  },
  {
    id: "inter_rater_agreement",
    weight: 0.06,
    rationale: "Simulated dual-rater agreement approximates scoring stability",
  },
  {
    id: "longitudinal_stability",
    weight: 0.05,
    rationale: "Test–retest / trajectory stability supports reliable measurement",
  },
  {
    id: "assessment_fairness",
    weight: 0.05,
    rationale: "Scoring must not systematically disadvantage subgroups",
  },
  {
    id: "language_parity",
    weight: 0.04,
    rationale: "EN/AR educational value must be comparable under matched cases",
  },
];

export function assertWeightMatrixValid(): void {
  const sum = ERI_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`ERI weight matrix sums to ${sum}, expected 1.0`);
  }
  const ids = new Set(ERI_WEIGHT_MATRIX.map((e) => e.id));
  if (ids.size !== ERI_WEIGHT_MATRIX.length) {
    throw new Error("Duplicate ERI dimension ids in weight matrix");
  }
}

export function weightMap(): Record<EriDimensionId, number> {
  return Object.fromEntries(
    ERI_WEIGHT_MATRIX.map((e) => [e.id, e.weight]),
  ) as Record<EriDimensionId, number>;
}

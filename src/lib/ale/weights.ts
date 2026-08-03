/**
 * Adaptive Learning Effectiveness (ALE) v1.0 — weight matrix.
 *
 * Weights sum to 1.0. Domains measure whether the Adaptive Curriculum selects
 * increasingly appropriate learning experiences (Mission ALE).
 * Do not alter weights without bumping ALE_VERSION.
 */

export const ALE_VERSION = "1.0.0";

export type AleDimensionId =
  | "difficulty_progression"
  | "case_sequencing"
  | "competency_remediation"
  | "learning_efficiency"
  | "knowledge_retention"
  | "reduction_of_repeated_mistakes"
  | "improvement_speed"
  | "case_diversity"
  | "instructor_objective_alignment"
  | "adaptive_accuracy"
  | "competency_graph_utilization"
  | "learning_pathway_quality";

export type AleWeightEntry = {
  id: AleDimensionId;
  weight: number;
  rationale: string;
};

/** Canonical weight matrix — sum MUST equal 1.0 within 1e-9. */
export const ALE_WEIGHT_MATRIX: AleWeightEntry[] = [
  {
    id: "difficulty_progression",
    weight: 0.1,
    rationale: "Difficulty should rise with mastery, not blindly each session",
  },
  {
    id: "case_sequencing",
    weight: 0.09,
    rationale: "Next-case fingerprints should target deficits without useless repeats",
  },
  {
    id: "competency_remediation",
    weight: 0.12,
    rationale: "Weak competencies must receive focused remediation cases",
  },
  {
    id: "learning_efficiency",
    weight: 0.09,
    rationale: "Gain per session / adaptive decision should be efficient",
  },
  {
    id: "knowledge_retention",
    weight: 0.08,
    rationale: "Late-session performance should retain mid-trajectory gains",
  },
  {
    id: "reduction_of_repeated_mistakes",
    weight: 0.09,
    rationale: "Miss flags / weak-focus recurrence should decline over time",
  },
  {
    id: "improvement_speed",
    weight: 0.09,
    rationale: "Overall score trajectory slope under adaptive curriculum",
  },
  {
    id: "case_diversity",
    weight: 0.07,
    rationale: "Disorder/difficulty diversity without abandoning remediation focus",
  },
  {
    id: "instructor_objective_alignment",
    weight: 0.07,
    rationale: "Adaptive focus should align with instructor/preset objectives when set",
  },
  {
    id: "adaptive_accuracy",
    weight: 0.08,
    rationale: "Selected focus matches measured weakest assessed competency",
  },
  {
    id: "competency_graph_utilization",
    weight: 0.06,
    rationale: "Graph root-cause / pathway used when CGE is available",
  },
  {
    id: "learning_pathway_quality",
    weight: 0.06,
    rationale: "Curriculum path is coherent, step-ordered, and non-empty",
  },
];

export function assertWeightMatrixValid(): void {
  const sum = ALE_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`ALE weight matrix sums to ${sum}, expected 1.0`);
  }
  const ids = new Set(ALE_WEIGHT_MATRIX.map((e) => e.id));
  if (ids.size !== ALE_WEIGHT_MATRIX.length) {
    throw new Error("Duplicate ALE dimension ids in weight matrix");
  }
}

export function weightMap(): Record<AleDimensionId, number> {
  return Object.fromEntries(
    ALE_WEIGHT_MATRIX.map((e) => [e.id, e.weight]),
  ) as Record<AleDimensionId, number>;
}

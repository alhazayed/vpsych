import type { AssessmentType } from "@/lib/scenario-templates/types";
import type { FeedbackMode, GradingMode, InstructorPreset } from "./types";

export type RubricDimension =
  | "diagnostic_accuracy"
  | "dsm_reasoning"
  | "icd_reasoning"
  | "communication"
  | "empathy"
  | "therapeutic_alliance"
  | "risk_assessment"
  | "safety_planning"
  | "documentation"
  | "treatment_planning"
  | "medication_decisions"
  | "professionalism"
  | "time_management";

export const ALL_RUBRIC_DIMENSIONS: RubricDimension[] = [
  "diagnostic_accuracy",
  "dsm_reasoning",
  "icd_reasoning",
  "communication",
  "empathy",
  "therapeutic_alliance",
  "risk_assessment",
  "safety_planning",
  "documentation",
  "treatment_planning",
  "medication_decisions",
  "professionalism",
  "time_management",
];

export type DimensionScore = {
  dimension: RubricDimension;
  score: number;
  max: number;
  notes: string;
};

export type InstructorReport = {
  presetId: string;
  presetName: string;
  assessmentType: AssessmentType;
  gradingMode: GradingMode;
  overallScore: number;
  maxScore: number;
  percent: number;
  dimensions: DimensionScore[];
  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];
  recommendations: string[];
  pass: boolean;
};

/** Derive UI/session modes from assessment_type when not explicitly set. */
export function modesForAssessment(type: AssessmentType): {
  grading_mode: GradingMode;
  feedback_mode: FeedbackMode;
  allow_hints: boolean;
} {
  switch (type) {
    case "osce_examination":
      return { grading_mode: "osce", feedback_mode: "none", allow_hints: false };
    case "risk_assessment":
    case "crisis_intervention":
      return {
        grading_mode: "practice",
        feedback_mode: "realtime_coaching",
        allow_hints: true,
      };
    case "cbt_session":
    case "dbt_session":
    case "psychodynamic_session":
      return {
        grading_mode: "practice",
        feedback_mode: "end_of_session",
        allow_hints: true,
      };
    default:
      return {
        grading_mode: "practice",
        feedback_mode: "end_of_session",
        allow_hints: true,
      };
  }
}

/**
 * Lightweight deterministic report generator for automated testing / demo.
 * Production scoring can replace the heuristics while keeping this shape.
 */
export function generateInstructorReport(input: {
  preset: InstructorPreset;
  transcriptTurns?: number;
  coveredObjectives?: string[];
  riskAddressed?: boolean;
  empathyScore?: number;
  diagnosisMentioned?: boolean;
  timeUsedMinutes?: number;
}): InstructorReport {
  const { preset } = input;
  const turns = input.transcriptTurns ?? 12;
  const empathy = input.empathyScore ?? 0.7;
  const covered = new Set(
    input.coveredObjectives ?? [preset.primary_objective],
  );
  const riskAddressed =
    input.riskAddressed ??
    (covered.has("suicide_assessment") || covered.has("risk_assessment"));
  const dx = input.diagnosisMentioned ?? turns >= 8;
  const timeUsed =
    input.timeUsedMinutes ?? Math.min(preset.time_limit_minutes, 25);

  const mk = (
    dimension: RubricDimension,
    value: number,
    notes: string,
    max = 10,
  ): DimensionScore => ({
    dimension,
    score: Math.max(0, Math.min(max, Math.round(value))),
    max,
    notes,
  });

  const dimensions: DimensionScore[] = [
    mk(
      "diagnostic_accuracy",
      dx ? 8 : 4,
      dx ? "Diagnosis explored" : "Limited diagnostic inquiry",
    ),
    mk("dsm_reasoning", dx ? 7 : 3, "DSM criteria coverage"),
    mk("icd_reasoning", dx ? 7 : 3, "ICD framing"),
    mk("communication", 6 + turns / 5, `${turns} clinician turns`),
    mk("empathy", empathy * 10, "Alliance / validation markers"),
    mk("therapeutic_alliance", empathy * 9 + 1, "Collaborative stance"),
    mk(
      "risk_assessment",
      riskAddressed ? 9 : 3,
      riskAddressed ? "Risk explored" : "Risk under-explored",
    ),
    mk(
      "safety_planning",
      riskAddressed ? 8 : 2,
      riskAddressed ? "Safety discussed" : "Safety plan missing",
    ),
    mk("documentation", turns >= 10 ? 7 : 4, "Session structure"),
    mk(
      "treatment_planning",
      covered.has("treatment_planning") ? 8 : 5,
      "Plan elements",
    ),
    mk(
      "medication_decisions",
      covered.has("medication_review") || covered.has("medication_counseling")
        ? 7
        : 5,
      "Med discussion",
    ),
    mk("professionalism", 8, "Professional conduct"),
    mk(
      "time_management",
      timeUsed <= preset.time_limit_minutes ? 8 : 4,
      `${timeUsed}/${preset.time_limit_minutes} min`,
    ),
  ];

  const overallScore = dimensions.reduce((s, d) => s + d.score, 0);
  const maxScore = dimensions.reduce((s, d) => s + d.max, 0);
  const percent = Math.round((overallScore / maxScore) * 100);

  const strengths = dimensions
    .filter((d) => d.score / d.max >= 0.75)
    .map((d) => d.dimension.replace(/_/g, " "));
  const weaknesses = dimensions
    .filter((d) => d.score / d.max < 0.5)
    .map((d) => d.dimension.replace(/_/g, " "));

  const missed: string[] = [];
  if (!covered.has(preset.primary_objective)) {
    missed.push(`Primary objective not evidenced: ${preset.primary_objective}`);
  }
  for (const o of preset.secondary_objectives) {
    if (!covered.has(o)) missed.push(`Secondary objective thin: ${o}`);
  }
  if (
    !riskAddressed &&
    /risk|suicide|violence|crisis|emergency/i.test(preset.primary_objective)
  ) {
    missed.push("Safety / risk not adequately assessed");
  }

  const recommendations: string[] = [];
  if (weaknesses.includes("empathy")) {
    recommendations.push("Increase reflective listening and validation");
  }
  if (weaknesses.includes("risk assessment")) {
    recommendations.push(
      "Use structured risk inquiry (ideation, intent, plan, means, protective factors)",
    );
  }
  if (weaknesses.includes("time management")) {
    recommendations.push("Prioritize high-yield history early in the station");
  }
  if (!recommendations.length) {
    recommendations.push(
      "Continue deliberate practice on differential formulation",
    );
  }

  const passThreshold =
    preset.grading.pass_threshold ??
    (preset.grading_mode === "practice" ? 50 : 70);

  return {
    presetId: preset.id,
    presetName: preset.name,
    assessmentType: preset.assessment_type,
    gradingMode: preset.grading_mode,
    overallScore,
    maxScore,
    percent,
    dimensions,
    strengths,
    weaknesses,
    missedOpportunities: missed,
    recommendations,
    pass: percent >= passThreshold,
  };
}

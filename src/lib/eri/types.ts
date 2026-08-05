/**
 * Educational Reliability Index — result contracts.
 */

import type { EriDimensionId } from "@/lib/eri/weights";

export type EriDimensionScore = {
  id: EriDimensionId;
  score: number;
  weight: number;
  weighted_contribution: number;
  confidence: number;
  evidence: string[];
  clinical_reasoning: string;
  recommendations: string[];
};

export type EriConfidenceInterval = {
  lower: number;
  upper: number;
  method: "weighted_dimension_uncertainty";
  level: 0.95;
};

export type EriVersionLock = {
  eri_version: string;
  assessment_version: string | null;
  rubric_version: string | null;
  competency_graph_version: string | null;
  adaptive_curriculum_version: string | null;
  prompt_version: string | null;
  model_version: string | null;
  computed_at: string;
};

export type EducationalReliabilityIndex = {
  overall: number;
  subscores: EriDimensionScore[];
  confidence_interval: EriConfidenceInterval;
  evidence: {
    learner_id: string | null;
    session_id: string | null;
    locale: string;
    difficulty: string | null;
    assessment_mode: string | null;
    dimensions: Record<string, string[]>;
  };
  educational_reasoning: string;
  recommendations: string[];
  versions: EriVersionLock;
  weight_matrix_version: string;
};

export type EriComputeInput = {
  locale: string;
  difficulty?: string | null;
  assessment_mode?: "llm_examiner" | "heuristic_fallback" | "simulation" | null;
  overall_score: number;
  item_count: number;
  items_with_feedback: number;
  mean_feedback_chars: number;
  narrative_chars: number;
  excerpt_count: number;
  learning_objectives_count: number;
  competencies_mapped: number;
  supervisor_feedback_chars: number;
  reflective_questions_count: number;
  learning_goals_count: number;
  remediation_steps: number;
  missed_opportunities_count: number;
  suggested_next_cases_count: number;
  suggested_reading_count: number;
  difficulty_matches_learner?: boolean | null;
  inter_session_r?: number | null;
  inter_rater_r?: number | null;
  inter_rater_pct_agree?: number | null;
  test_retest_r?: number | null;
  cronbach_alpha?: number | null;
  fairness_pass?: boolean | null;
  language_parity_within_tolerance?: boolean | null;
  language_parity_abs_diff?: number | null;
  learner_id?: string | null;
  session_id?: string | null;
  assessment_version?: string | null;
  rubric_version?: string | null;
  competency_graph_version?: string | null;
  adaptive_curriculum_version?: string | null;
  prompt_version?: string | null;
  model_version?: string | null;
};

export type EriAggregateRow = {
  key: string;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  ci95: { lower: number; upper: number };
};

export type EriDashboardData = {
  eri_version: string;
  overall_mean: number | null;
  n: number;
  learner_trend: Array<{ at: string; mean: number; n: number }>;
  instructor_report: {
    mean_eri: number | null;
    low_dimension_hotspots: Array<{ id: string; mean: number; n: number }>;
    heuristic_share: number | null;
    recommendations: string[];
  };
  by_difficulty: EriAggregateRow[];
  by_language: EriAggregateRow[];
  low_eri_recommendations: string[];
};

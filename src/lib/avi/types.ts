/**
 * Assessment Validity Index — result contracts.
 */

import type { AviDimensionId } from "@/lib/avi/weights";

export type AviDimensionScore = {
  id: AviDimensionId;
  score: number;
  weight: number;
  weighted_contribution: number;
  confidence: number;
  evidence: string[];
  scientific_reasoning: string;
  recommendations: string[];
};

export type AviConfidenceInterval = {
  lower: number;
  upper: number;
  method: "weighted_dimension_uncertainty";
  level: 0.95;
};

export type AviVersionLock = {
  avi_version: string;
  assessment_schema_version: string | null;
  prompt_version: string | null;
  model_version: string | null;
  rubric_version: string | null;
  computed_at: string;
};

export type AssessmentValidityIndex = {
  overall: number;
  /** Score variance from repeated assessments when available */
  variance: number | null;
  subscores: AviDimensionScore[];
  confidence_interval: AviConfidenceInterval;
  evidence: {
    assessment_mode: string | null;
    locale: string;
    rubric_item_count: number;
    repeat_n: number | null;
    dimensions: Record<string, string[]>;
  };
  validity_report: string;
  recommendations: string[];
  versions: AviVersionLock;
  weight_matrix_version: string;
};

export type AviComputeInput = {
  locale: string;
  assessment_mode?: "llm_examiner" | "heuristic_fallback" | "simulation" | null;
  rubric_item_count: number;
  clinical_core_item_ids: string[];
  competencies_mapped: number;
  learning_objectives_count: number;
  mean_feedback_chars: number;
  narrative_chars: number;
  excerpt_count: number;
  has_scientific_provenance: boolean;
  has_external_criterion?: boolean | null;
  criterion_correlation?: number | null;
  cronbach_alpha?: number | null;
  test_retest_r?: number | null;
  discrimination_index?: number | null;
  difficulty_separation?: number | null;
  fairness_pass?: boolean | null;
  language_parity_within_tolerance?: boolean | null;
  language_parity_abs_diff?: number | null;
  /** Repeated assessment overalls for the same case */
  repeated_overalls?: number[] | null;
  assessment_schema_version?: string | null;
  prompt_version?: string | null;
  model_version?: string | null;
  rubric_version?: string | null;
};

export type AviAggregateRow = {
  key: string;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  ci95: { lower: number; upper: number };
};

export type AviDashboardData = {
  avi_version: string;
  overall_mean: number | null;
  n: number;
  mean_variance: number | null;
  stability_trend: Array<{ at: string; mean: number; variance: number | null; n: number }>;
  validity_summary: {
    mean_avi: number | null;
    low_dimension_hotspots: Array<{ id: string; mean: number; n: number }>;
    heuristic_share: number | null;
    external_criterion_disclosed: boolean;
    recommendations: string[];
  };
  by_mode: AviAggregateRow[];
  by_language: AviAggregateRow[];
  low_avi_recommendations: string[];
};

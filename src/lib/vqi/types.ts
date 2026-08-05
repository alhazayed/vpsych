/**
 * VPsych Quality Index — result contracts.
 */

import type { VqiMetricId, VqiWeightSet } from "@/lib/vqi/weights";

export type VqiEntityType =
  | "assessment"
  | "learner"
  | "instructor"
  | "institution"
  | "clinical_template"
  | "disorder"
  | "language"
  | "persona"
  | "release"
  | "platform"
  | "ai_model";

export type VqiSubIndex = {
  metric_id: VqiMetricId;
  score: number | null;
  weight: number;
  effective_weight: number;
  confidence: number;
  missing: boolean;
  version: string | null;
  contribution: number;
};

export type VqiConfidenceInterval = {
  lower: number;
  upper: number;
  method: "weighted_dimension_uncertainty";
  level: 0.95;
};

export type VqiConfidenceBundle = {
  overall: number;
  scientific: number;
  clinical: number;
  educational: number;
  technical: number;
  institutional: number;
  research: number;
};

export type VqiMaturityLevel =
  | "experimental"
  | "development"
  | "pilot_ready"
  | "production_ready"
  | "world_class";

export type VqiProvenance = {
  vqi_version: string;
  algorithm_version: string;
  weight_set_id: string;
  weight_version: string;
  metric_versions: Record<string, string>;
  prompt_version: string | null;
  model_version: string | null;
  clinical_template_version: string | number | null;
  persona_version: string | null;
  competency_graph_version: string | null;
  adaptive_curriculum_version: string | null;
  instructor_preset_version: string | number | null;
  assessment_schema_version: string | null;
  platform_release_version: string | null;
  computed_at: string;
};

export type VPsychQualityIndex = {
  overall: number;
  entity_type: VqiEntityType;
  entity_id: string;
  subscores: VqiSubIndex[];
  confidence_interval: VqiConfidenceInterval;
  confidence: VqiConfidenceBundle;
  maturity: VqiMaturityLevel;
  missing_metrics: VqiMetricId[];
  outlier: boolean;
  scientific_interpretation: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  provenance: VqiProvenance;
};

export type VqiMetricObservation = {
  metric_id: VqiMetricId;
  score: number | null;
  confidence?: number | null;
  version?: string | null;
};

export type VqiComputeInput = {
  entity_type: VqiEntityType;
  entity_id: string;
  metrics: VqiMetricObservation[];
  weight_set: VqiWeightSet;
  prompt_version?: string | null;
  model_version?: string | null;
  clinical_template_version?: string | number | null;
  persona_version?: string | null;
  competency_graph_version?: string | null;
  adaptive_curriculum_version?: string | null;
  instructor_preset_version?: string | number | null;
  assessment_schema_version?: string | null;
  platform_release_version?: string | null;
  /** Prior VQI for drift/regression detection */
  prior_overall?: number | null;
};

export type VqiTrendPoint = {
  at: string;
  period: "day" | "week" | "month" | "quarter" | "year";
  mean: number;
  n: number;
  moving_average_7?: number | null;
};

export type VqiBenchmarkComparison = {
  label: string;
  reference: number;
  current: number;
  delta: number;
  meaningful: boolean;
  method: "abs_diff_gt_5" | "ci_nonoverlap";
};

export type VqiQualityCertificate = {
  certificate_id: string;
  issued_at: string;
  overall_vqi: number;
  maturity: VqiMaturityLevel;
  confidence: VqiConfidenceBundle;
  sub_indices: Array<{ metric_id: string; score: number | null; weight: number }>;
  platform_readiness: string;
  institution_readiness: string;
  research_readiness: string;
  scientific_interpretation: string;
  provenance: VqiProvenance;
};

export type VqiDashboardData = {
  vqi_version: string;
  weight_set: VqiWeightSet;
  platform_vqi: VPsychQualityIndex | null;
  certificate: VqiQualityCertificate | null;
  by_entity: Array<{
    entity_type: VqiEntityType;
    entity_id: string;
    overall: number;
    maturity: VqiMaturityLevel;
    n: number;
  }>;
  trends: VqiTrendPoint[];
  benchmarks: VqiBenchmarkComparison[];
  heat_map: Array<{ row: string; col: string; value: number }>;
  radar: Array<{ metric_id: string; score: number }>;
  distribution: Array<{ bucket: string; n: number }>;
  outliers: Array<{ entity_type: string; entity_id: string; overall: number }>;
  recommendations: string[];
};

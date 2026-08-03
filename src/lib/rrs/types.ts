/**
 * Research Readiness Score — result contracts.
 */

import type { RrsDimensionId } from "@/lib/rrs/weights";

export type RrsDimensionScore = {
  id: RrsDimensionId;
  score: number;
  weight: number;
  weighted_contribution: number;
  confidence: number;
  evidence: string[];
  scientific_reasoning: string;
  recommendations: string[];
};

export type RrsConfidenceInterval = {
  lower: number;
  upper: number;
  method: "weighted_dimension_uncertainty";
  level: 0.95;
};

export type RrsVersionLock = {
  rrs_version: string;
  dataset_version: string | null;
  schema_version: string | null;
  prompt_version: string | null;
  model_version: string | null;
  export_version: string | null;
  computed_at: string;
};

export type VersionMatrixRow = {
  component: string;
  version: string | null;
  status: "locked" | "partial" | "missing";
};

export type ReproducibilityMatrixRow = {
  artifact: string;
  seeded: boolean;
  offline_corpus: boolean;
  version_locked: boolean;
  notes: string;
};

export type ResearchReadinessScore = {
  overall: number;
  subscores: RrsDimensionScore[];
  confidence_interval: RrsConfidenceInterval;
  evidence: {
    dataset_id: string | null;
    dimensions: Record<string, string[]>;
  };
  publication_readiness_report: string;
  dataset_quality_report: string;
  recommendations: string[];
  version_matrix: VersionMatrixRow[];
  reproducibility_matrix: ReproducibilityMatrixRow[];
  versions: RrsVersionLock;
  weight_matrix_version: string;
};

export type RrsComputeInput = {
  dataset_id?: string | null;
  has_prompt_version: boolean;
  has_assessment_schema_version: boolean;
  has_case_snapshot_version: boolean;
  has_ace_version: boolean;
  has_cge_version: boolean;
  has_rubric_version: boolean;
  has_persona_stamp: boolean;
  has_template_version: boolean;
  has_model_stamp: boolean;
  heuristic_disclosed: boolean;
  evidence_lock_count: number;
  peer_metric_corpora: number;
  audit_trail_present: boolean;
  seeded_sims_present: boolean;
  scientific_meta_fields: number;
  scientific_meta_required: number;
  assessment_provenance_present: boolean;
  longitudinal_session_order_ok: boolean;
  research_export_api_present: boolean;
  anonymization_pipeline_present: boolean;
  gdpr_dsar_productized: boolean;
  gdpr_documented: boolean;
  irb_high_stakes_disclosed: boolean;
  dataset_version?: string | null;
  schema_version?: string | null;
  prompt_version?: string | null;
  model_version?: string | null;
  export_version?: string | null;
};

export type RrsDashboardData = {
  rrs_version: string;
  overall_mean: number | null;
  n: number;
  publication_readiness: {
    mean_rrs: number | null;
    low_dimension_hotspots: Array<{ id: string; mean: number; n: number }>;
    recommendations: string[];
  };
  dataset_quality: {
    mean_completeness: number | null;
    mean_integrity: number | null;
    mean_metadata: number | null;
  };
  version_matrix: VersionMatrixRow[];
  reproducibility_matrix: ReproducibilityMatrixRow[];
  low_rrs_recommendations: string[];
};

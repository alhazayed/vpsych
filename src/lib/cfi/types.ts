/**
 * Clinical Fidelity Index — result contracts.
 */

import type { CfiDimensionId } from "@/lib/cfi/weights";

export type CfiDimensionScore = {
  id: CfiDimensionId;
  score: number;
  weight: number;
  weighted_contribution: number;
  confidence: number;
  evidence: string[];
  clinical_reasoning: string;
  recommendations: string[];
};

export type CfiConfidenceInterval = {
  /** Approximate 95% CI lower bound for overall CFI */
  lower: number;
  /** Approximate 95% CI upper bound for overall CFI */
  upper: number;
  method: "weighted_dimension_uncertainty";
  level: 0.95;
};

export type CfiVersionLock = {
  cfi_version: string;
  prompt_version: string | null;
  model_version: string | null;
  persona_version: string | null;
  clinical_template_version: string | number | null;
  assessment_schema_version: string | null;
  disorder_package_version: string | null;
  computed_at: string;
};

export type ClinicalFidelityIndex = {
  overall: number;
  subscores: CfiDimensionScore[];
  confidence_interval: CfiConfidenceInterval;
  evidence: {
    disorder_slug: string;
    locale: string;
    severity: string | null;
    dsm5_code: string | null;
    icd11_code: string | null;
    dimensions: Record<string, string[]>;
  };
  clinical_reasoning: string;
  recommendations: string[];
  versions: CfiVersionLock;
  weight_matrix_version: string;
};

export type CfiComputeInput = {
  disorder_slug: string;
  disorder_name?: string;
  dsm5_code: string | null;
  icd11_code: string | null;
  dsm5_optional?: boolean;
  severity?: string | null;
  onset_duration?: string | null;
  symptom_count: number;
  symptom_domains: string[];
  risk: {
    suicidal_ideation?: string;
    self_harm?: boolean;
    harm_to_others?: boolean;
    substance_use?: boolean;
    escalation_rules?: string | null;
  };
  differentials_count: number;
  rule_outs_count: number;
  teaching_points_count: number;
  disclosure_rules_count: number;
  comorbidities: Array<{ slug: string; compatible?: boolean }>;
  locale: string;
  memory_scope?: string | null;
  has_clinical_teaching?: boolean;
  has_insight_cue?: boolean;
  has_judgment_cue?: boolean;
  has_speech_cue?: boolean;
  has_medication_cue?: boolean;
  has_trauma_cue?: boolean;
  has_culture_cue?: boolean;
  has_voice_profile?: boolean;
  prompt_version?: string | null;
  model_version?: string | null;
  persona_version?: string | null;
  template_version?: string | number | null;
  assessment_schema_version?: string | null;
  disorder_package_version?: string | null;
  evidence_grade?: "A" | "B" | "C" | "unsupported" | null;
  impossible_timeline?: boolean;
  prompt_leakage_detected?: boolean;
  culture_rewrites_codes?: boolean;
};

export type CfiAggregateRow = {
  key: string;
  n: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  ci95: { lower: number; upper: number };
};

export type CfiDashboardData = {
  cfi_version: string;
  overall_mean: number | null;
  n: number;
  trend: Array<{ at: string; mean: number; n: number }>;
  by_disorder: CfiAggregateRow[];
  by_language: CfiAggregateRow[];
  low_cfi_recommendations: string[];
};

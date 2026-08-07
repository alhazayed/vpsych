/**
 * Stage 8 — Scientific Validation Platform contracts.
 *
 * Observational only: measure whether the existing patient behaves realistically.
 * NEVER writes clinical_snapshot / case_memory / LTM / DecisionPlan / patient prompts.
 * NEVER assigns diagnoses. NEVER fabricates significance or invents results.
 */

export const VALIDATION_VERSION = "1.0.0" as const;
export const VALIDATION_FRAMEWORK_VERSION = 1 as const;
export const VALIDATION_ALGORITHM_VERSION = "1.0.0" as const;

/** Longitudinal horizon sizes for automatic evaluation. */
export const LONGITUDINAL_HORIZONS = [
  10, 25, 50, 100, 250, 500,
] as const;
export type LongitudinalHorizon = (typeof LONGITUDINAL_HORIZONS)[number];

/** Clinical realism dimensions (observational scores 0–100). */
export type RealismDimensionId =
  | "speech_realism"
  | "emotion_realism"
  | "behaviour_realism"
  | "diagnostic_realism"
  | "longitudinal_realism"
  | "therapy_realism"
  | "memory_realism"
  | "alliance_realism"
  | "response_latency"
  | "conversation_flow"
  | "naturalness"
  | "consistency"
  | "insight"
  | "defensiveness"
  | "avoidance"
  | "motivation"
  | "hope"
  | "hopelessness"
  | "protective_factors"
  | "risk_behaviour"
  | "mse_realism";

/** DSM/ICD coherence checks — consistency only, never diagnosis assignment. */
export type DsmValidationDimensionId =
  | "dsm_coherence"
  | "icd_coherence"
  | "differential_reasoning"
  | "symptom_overlap"
  | "comorbidity_realism"
  | "timeline_realism"
  | "severity_realism"
  | "subtype_realism";

/** Quality metrics tracked by the Metrics Engine. */
export type QualityMetricId =
  | "realism_index"
  | "consistency_index"
  | "clinical_fidelity"
  | "memory_integrity"
  | "diagnostic_stability"
  | "conversation_quality"
  | "alliance_score"
  | "behaviour_stability"
  | "decision_stability"
  | "session_quality";

export type ConfidenceInterval = {
  lower: number;
  upper: number;
  level: 0.95;
  method: string;
};

export type DimensionScore = {
  id: string;
  score: number;
  weight: number;
  confidence: number;
  evidence: string[];
  notes: string[];
};

export type ObservationalMessage = {
  role: string;
  content: string;
  created_at?: string;
};

/** Frozen clinical observables — read-only views of existing patient state. */
export type ClinicalObservables = {
  session_id: string;
  disorder_slug: string | null;
  disorder_name: string | null;
  dsm5_code: string | null;
  icd11_code: string | null;
  severity: string | null;
  onset_duration: string | null;
  locale: string;
  difficulty: string | null;
  therapy_modality: string | null;
  symptom_count: number;
  symptom_domains: string[];
  comorbidities: Array<{ slug: string; name?: string }>;
  differentials_count: number;
  rule_outs_count: number;
  teaching_points_count: number;
  has_mse: boolean;
  has_protective_factors: boolean;
  has_formulation: boolean;
  has_personality_freeze: boolean;
  has_scientific_meta: boolean;
  memory_scope: string | null;
  risk: {
    suicidal_ideation?: string | null;
    self_harm?: boolean;
    harm_to_others?: boolean;
    substance_use?: boolean;
  };
};

export type AssessmentObservables = {
  overall: number;
  items: Array<{
    id?: string;
    label?: string;
    score: number;
    max: number;
    weight?: number;
  }>;
  narrative_length: number;
  excerpt_count: number;
  language: string | null;
  ai_source: string | null;
  model: string | null;
};

export type SessionObservables = {
  clinical: ClinicalObservables;
  assessment: AssessmentObservables | null;
  messages: ObservationalMessage[];
  duration_sec: number | null;
  turn_count: number;
  therapist_turn_count: number;
  patient_turn_count: number;
  avg_patient_chars: number;
  avg_therapist_chars: number;
  /** Optional sealed quality metrics from Quality Ledger (read-only). */
  ledger_metrics?: Record<string, number>;
};

export type ExpertRatingDomain =
  | "overall_realism"
  | "diagnostic_agreement"
  | "risk_agreement"
  | "communication_agreement"
  | "alliance"
  | "mse"
  | "emotion"
  | "behaviour"
  | "therapy_response";

export type ExpertRating = {
  id: string;
  rater_id: string;
  session_id: string | null;
  case_key: string;
  domain: ExpertRatingDomain;
  score: number; // 0–100 or Likert mapped
  scale_max: number;
  notes: string | null;
  rated_at: string;
  study_id: string | null;
};

export type InterRaterResult = {
  domain: ExpertRatingDomain | "aggregate";
  n_raters: number;
  n_cases: number;
  percent_agreement: number | null;
  cohen_kappa: number | null;
  icc: number | null;
  weighted_agreement: number | null;
  evidence: string[];
  /** Never invent significance — null when underpowered. */
  sufficient_for_inference: boolean;
};

export type BenchmarkSource =
  | "vpsych"
  | "synthetic_baseline"
  | "expert_authored"
  | "historical_simulation"
  | "gold_standard";

export type BenchmarkCase = {
  id: string;
  source: BenchmarkSource;
  label: string;
  disorder_slug: string | null;
  observables: Partial<SessionObservables>;
  gold_scores?: Partial<Record<RealismDimensionId | QualityMetricId, number>>;
};

export type BenchmarkComparison = {
  metric: string;
  vpsych: number | null;
  baseline: number | null;
  delta: number | null;
  source: BenchmarkSource;
  notes: string[];
};

export type PsychometricValidityKind =
  | "internal_consistency"
  | "face_validity"
  | "construct_validity"
  | "content_validity"
  | "criterion_validity"
  | "convergent_validity"
  | "discriminant_validity"
  | "known_groups_validity";

export type PsychometricValidityResult = {
  kind: PsychometricValidityKind;
  score: number | null;
  n: number;
  evidence: string[];
  /** Explicit: do not claim statistical significance without study design. */
  significance_claimed: false;
  limitations: string[];
};

export type LongitudinalMetricId =
  | "identity_stability"
  | "personality_drift"
  | "emotion_drift"
  | "memory_integrity"
  | "therapy_progression"
  | "symptom_evolution"
  | "alliance_evolution"
  | "adaptive_realism";

export type LongitudinalHorizonResult = {
  horizon: LongitudinalHorizon;
  metrics: Record<LongitudinalMetricId, number>;
  confidence_interval: ConfidenceInterval;
  evidence: string[];
  simulated: boolean;
};

export type ValidationAuditReportKind =
  | "validation"
  | "clinical"
  | "consistency"
  | "decision"
  | "risk"
  | "realism";

export type ValidationAuditReport = {
  kind: ValidationAuditReportKind;
  session_id: string | null;
  generated_at: string;
  scores: DimensionScore[];
  overall: number | null;
  findings: string[];
  limitations: string[];
  versions: ValidationVersionLock;
};

export type ValidationVersionLock = {
  validation_version: string;
  framework_version: number;
  algorithm_version: string;
  assessment_schema_version: string | null;
  prompt_version: string | null;
  computed_at: string;
};

export type QualityMetricsBundle = Record<QualityMetricId, number>;

export type ResearchExportFormat = "csv" | "json" | "fhir" | "package";

export type ResearchDatasetPackage = {
  format: "vpsych-validation-research-package";
  version: string;
  anonymized: true;
  exported_at: string;
  n_sessions: number;
  n_ratings: number;
  audit_log_id: string;
  dataset: Record<string, unknown>;
  fhir_bundle?: Record<string, unknown>;
  reproducibility: {
    validation_version: string;
    algorithm_version: string;
    git_sha: string | null;
    seed: string | null;
  };
};

export type PublicationSupportPackage = {
  methods: string[];
  results_tables: Array<{
    title: string;
    columns: string[];
    rows: Array<Array<string | number | null>>;
  }>;
  figure_specs: Array<{
    id: string;
    title: string;
    chart: "trend" | "ci" | "reliability" | "benchmark" | "radar";
    series: Array<{ label: string; values: number[] }>;
  }>;
  limitations: string[];
  reproducibility_metadata: Record<string, string | number | null>;
  statistical_summaries: Array<{
    label: string;
    n: number;
    mean: number | null;
    sd: number | null;
    ci: ConfidenceInterval | null;
    /** Always false unless a real study protocol supplies inference. */
    significance_claimed: false;
  }>;
  disclaimer: string;
};

export type ValidationRunResult = {
  id: string;
  session_id: string | null;
  study_id: string | null;
  created_at: string;
  realism: {
    overall: number;
    dimensions: DimensionScore[];
    confidence_interval: ConfidenceInterval;
  };
  dsm: {
    overall: number;
    dimensions: DimensionScore[];
  };
  consistency: {
    overall: number;
    dimensions: DimensionScore[];
  };
  reliability: {
    overall: number | null;
    inter_rater: InterRaterResult[];
    notes: string[];
  };
  psychometrics: PsychometricValidityResult[];
  metrics: QualityMetricsBundle;
  benchmarks: BenchmarkComparison[];
  longitudinal: LongitudinalHorizonResult[];
  audits: ValidationAuditReport[];
  versions: ValidationVersionLock;
  observational: true;
  patient_state_modified: false;
};

export type ValidationDashboardSnapshot = {
  version: string;
  generated_at: string;
  n_runs: number;
  n_ratings: number;
  trend: Array<{ at: string; realism_index: number; consistency_index: number }>;
  confidence_intervals: Array<{ metric: string; ci: ConfidenceInterval }>;
  reliability_plots: InterRaterResult[];
  validation_history: Array<{
    id: string;
    session_id: string | null;
    overall_realism: number;
    created_at: string;
  }>;
  benchmark_comparisons: BenchmarkComparison[];
  expert_ratings_summary: {
    n: number;
    domains: Record<string, { n: number; mean: number }>;
  };
  quality_metrics_means: Partial<QualityMetricsBundle>;
  limitations: string[];
};

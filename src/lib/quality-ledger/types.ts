/**
 * Quality Ledger Engine v1.0 — types.
 */

export const QUALITY_LEDGER_VERSION = "1.0.0";
export const QUALITY_ALGORITHM_VERSION = "1.0.0";
export const QUALITY_LEDGER_MIGRATION = "20260805214500";

export type QualityLedgerEventType =
  | "assessment_completed"
  | "report_generated"
  | "competency_updated"
  | "adaptive_curriculum_updated"
  | "clinical_template_updated"
  | "instructor_preset_updated"
  | "ai_model_changed"
  | "platform_upgraded"
  | "correction"
  | "cvl_cfl_assigned";

export type QualitySnapshotType =
  | "clinical_template"
  | "persona"
  | "prompt"
  | "rubric"
  | "competency_graph"
  | "adaptive_curriculum"
  | "instructor_preset"
  | "scoring_rules"
  | "assessment_schema"
  | "case_instance";

export type QualityMetricScoreRow = {
  metric_id: string;
  metric_version: string | null;
  score: number;
  ci_lower: number | null;
  ci_upper: number | null;
  weight: number | null;
  contribution: number | null;
  confidence: number | null;
  evidence: Record<string, unknown>;
  breakdown: unknown[];
  algorithm_version: string | null;
};

export type QualityConfidenceRow = {
  overall: number;
  scientific: number;
  clinical: number;
  educational: number;
  technical: number;
  institutional: number | null;
  research: number | null;
  interval: { lower?: number; upper?: number; level?: number };
};

export type QualitySnapshotRow = {
  snapshot_type: QualitySnapshotType;
  version: string | null;
  content_hash: string;
  payload: Record<string, unknown>;
};

export type QualityCompetencyRow = {
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  improvement: number | null;
  regression: number | null;
  mastery: number | null;
  decay: number | null;
  prerequisite_completion: number | null;
  learning_velocity: number | null;
};

export type QualityLedgerEntry = {
  id: string;
  ledger_version: number;
  previous_ledger_id: string | null;
  supersedes_reason: string | null;
  event_type: QualityLedgerEventType;
  assessment_id: string | null;
  session_id: string | null;
  report_id: string | null;
  learner_id: string | null;
  instructor_id: string | null;
  institution_id: string | null;
  program_id: string | null;
  clinical_template_id: string | null;
  clinical_template_version: string | null;
  persona_id: string | null;
  persona_version: string | null;
  diagnosis_slug: string | null;
  comorbidities: Array<{ slug?: string; name?: string }>;
  language: string | null;
  locale: string | null;
  voice_profile_id: string | null;
  instructor_preset_id: string | null;
  instructor_preset_version: string | null;
  competency_graph_version: string | null;
  adaptive_curriculum_version: string | null;
  assessment_rubric_version: string | null;
  prompt_version: string | null;
  prompt_hash: string | null;
  system_prompt_hash: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  ai_model_version: string | null;
  reasoning_model: string | null;
  fallback_used: boolean;
  fallback_reason: string | null;
  assessment_duration_sec: number | null;
  conversation_turns: number | null;
  word_count: number | null;
  token_count: number | null;
  latency_ms: number | null;
  vqi: number | null;
  cfi: number | null;
  eri: number | null;
  avi: number | null;
  ale: number | null;
  rrs: number | null;
  scientific_confidence: number | null;
  educational_confidence: number | null;
  clinical_confidence: number | null;
  technical_confidence: number | null;
  overall_confidence: number | null;
  assessment_engine_version: string | null;
  scoring_engine_version: string | null;
  metric_algorithm_version: string | null;
  quality_algorithm_version: string;
  platform_release_version: string | null;
  created_by: string | null;
  created_at: string;
  git_commit_sha: string | null;
  supabase_migration_version: string | null;
  deployment_id: string | null;
  vercel_deployment: string | null;
  environment: string | null;
  database_schema_version: string | null;
  calculation_inputs: Record<string, unknown>;
  weight_matrix: unknown[];
  metric_breakdown: unknown[];
  evidence: Record<string, unknown>;
  confidence_interval: Record<string, unknown>;
  reasoning_summary: string | null;
  content_hash: string;
  payload: Record<string, unknown>;
  scores: QualityMetricScoreRow[];
  confidence: QualityConfidenceRow | null;
  snapshots: QualitySnapshotRow[];
  competency: QualityCompetencyRow | null;
};

export type QualityLedgerBuildInput = {
  event_type?: QualityLedgerEventType;
  previous_ledger_id?: string | null;
  supersedes_reason?: string | null;
  assessment_id?: string | null;
  session_id?: string | null;
  report_id?: string | null;
  learner_id?: string | null;
  instructor_id?: string | null;
  institution_id?: string | null;
  program_id?: string | null;
  clinical_template_id?: string | null;
  clinical_template_version?: string | null;
  persona_id?: string | null;
  persona_version?: string | null;
  diagnosis_slug?: string | null;
  comorbidities?: Array<{ slug?: string; name?: string }>;
  language?: string | null;
  locale?: string | null;
  voice_profile_id?: string | null;
  instructor_preset_id?: string | null;
  instructor_preset_version?: string | null;
  competency_graph_version?: string | null;
  adaptive_curriculum_version?: string | null;
  assessment_rubric_version?: string | null;
  prompt_version?: string | null;
  prompt_text?: string | null;
  system_prompt_text?: string | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  ai_model_version?: string | null;
  reasoning_model?: string | null;
  fallback_used?: boolean;
  fallback_reason?: string | null;
  assessment_duration_sec?: number | null;
  conversation_turns?: number | null;
  word_count?: number | null;
  token_count?: number | null;
  latency_ms?: number | null;
  created_by?: string | null;
  metrics: {
    cfi?: { overall: number; version?: string; ci?: { lower: number; upper: number }; confidence?: number; breakdown?: unknown[]; evidence?: Record<string, unknown> };
    eri?: { overall: number; version?: string; ci?: { lower: number; upper: number }; confidence?: number; breakdown?: unknown[]; evidence?: Record<string, unknown> };
    avi?: { overall: number; version?: string; ci?: { lower: number; upper: number }; confidence?: number; breakdown?: unknown[]; evidence?: Record<string, unknown> };
    ale?: { overall: number; version?: string; ci?: { lower: number; upper: number }; confidence?: number; breakdown?: unknown[]; evidence?: Record<string, unknown> };
    rrs?: { overall: number; version?: string; ci?: { lower: number; upper: number }; confidence?: number; breakdown?: unknown[]; evidence?: Record<string, unknown> };
    vqi?: {
      overall: number;
      version?: string;
      ci?: { lower: number; upper: number };
      confidence?: {
        overall: number;
        scientific: number;
        clinical: number;
        educational: number;
        technical: number;
        institutional?: number;
        research?: number;
      };
      weight_matrix?: unknown[];
      breakdown?: unknown[];
      evidence?: Record<string, unknown>;
      reasoning?: string;
    };
  };
  snapshots?: QualitySnapshotRow[];
  competency?: QualityCompetencyRow | null;
  calculation_inputs?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  platform_release_version?: string | null;
  assessment_engine_version?: string | null;
  scoring_engine_version?: string | null;
  metric_algorithm_version?: string | null;
  git_commit_sha?: string | null;
  deployment_id?: string | null;
  vercel_deployment?: string | null;
  environment?: string | null;
  database_schema_version?: string | null;
  payload?: Record<string, unknown>;
};

export type QualityTimelinePoint = {
  at: string;
  ledger_id: string;
  event_type: QualityLedgerEventType;
  vqi: number | null;
  cfi: number | null;
  eri: number | null;
  avi: number | null;
  session_id: string | null;
  diagnosis_slug: string | null;
};

export type QualityBenchmarkRow = {
  label: string;
  reference: number;
  current: number;
  delta: number;
  meaningful: boolean;
  method: string;
};

export type QualityLedgerDashboard = {
  ledger_version: string;
  algorithm_version: string;
  n: number;
  mean_vqi: number | null;
  immutable: true;
  by_event: Array<{ event_type: string; n: number }>;
  by_diagnosis: Array<{ key: string; n: number; mean_vqi: number }>;
  by_model: Array<{ key: string; n: number; mean_vqi: number }>;
  by_language: Array<{ key: string; n: number; mean_vqi: number }>;
  by_release: Array<{ key: string; n: number; mean_vqi: number }>;
  recent: Array<{
    id: string;
    created_at: string;
    session_id: string | null;
    diagnosis_slug: string | null;
    vqi: number | null;
    event_type: string;
    content_hash: string;
  }>;
  trends: Array<{ at: string; mean_vqi: number; n: number }>;
  recommendations: string[];
};

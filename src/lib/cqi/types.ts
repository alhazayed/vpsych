/**
 * Clinical Quality Intelligence (CQI) — domain types.
 */

export const CQI_VERSION = "1.0.0";

export const CQI_CATEGORIES = [
  "clinical_realism",
  "human_conversation",
  "language",
  "voice",
  "emotion",
  "patient_behaviour",
  "educational_value",
  "assessment",
  "report",
  "user_interface",
  "performance",
  "security",
  "research",
  "other",
] as const;

export type CqiCategory = (typeof CQI_CATEGORIES)[number];

export const CQI_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "suggestion",
] as const;

export type CqiSeverity = (typeof CQI_SEVERITIES)[number];

export const CQI_CONFIDENCES = ["definitely", "probably", "possibly"] as const;
export type CqiConfidence = (typeof CQI_CONFIDENCES)[number];

export const CQI_STATUSES = [
  "submitted",
  "triaged",
  "clustered",
  "in_progress",
  "resolved",
  "verified",
  "certified",
  "dismissed",
] as const;

export type CqiStatus = (typeof CQI_STATUSES)[number];

export type CqiQualityScores = {
  clinical_realism?: number;
  conversation_realism?: number;
  educational_usefulness?: number;
  voice_realism?: number;
  assessment_quality?: number;
  overall_confidence?: number;
};

export type CqiAnnotation = {
  message_id?: string | null;
  role?: "user" | "assistant" | "system";
  quote: string;
  note?: string;
  start?: number;
  end?: number;
};

export type CqiTranscriptTurn = {
  id?: string;
  role: string;
  content: string;
  created_at?: string;
};

/** Auto-captured context — reviewer never fills this manually. */
export type CqiCaptureContext = {
  session_id: string;
  assessment_id: string | null;
  patient_id: string | null;
  avatar_id: string | null;
  case_instance_id: string | null;
  disorder: string | null;
  disorder_slug: string | null;
  difficulty: string | null;
  language: string | null;
  voice: {
    voice_profile_id?: string | null;
    voice_id?: string | null;
    locale?: string | null;
  };
  llm_model: string | null;
  prompt_version: string | null;
  pme_version: string | null;
  tre_version: string | null;
  timestamp: string;
  transcript_window: CqiTranscriptTurn[];
  current_message: CqiTranscriptTurn | null;
  patient_mind_state: unknown | null;
  assessment_state: unknown | null;
  browser: {
    user_agent: string;
    language?: string;
    platform?: string;
    viewport?: { w: number; h: number };
  };
  platform_version: string;
  release_version: string;
  cqi_version: string;
};

export type CqiFlagSubmission = {
  session_id: string;
  anonymous?: boolean;
  category: CqiCategory;
  severity: CqiSeverity;
  confidence: CqiConfidence;
  free_text: string;
  suggested_improvement?: string;
  expected_behaviour?: string;
  reduces_educational_quality?: boolean | null;
  usable_in_residency?: boolean | null;
  scores?: CqiQualityScores;
  would_recommend?: boolean | null;
  annotations?: CqiAnnotation[];
  context: CqiCaptureContext;
  evidence?: Record<string, unknown>;
  /** Client may pre-upload attachment ids */
  attachment_ids?: string[];
};

export type CqiFlagRow = {
  id: string;
  created_at: string;
  reviewer_id: string | null;
  anonymous: boolean;
  session_id: string | null;
  category: CqiCategory;
  severity: CqiSeverity;
  confidence: CqiConfidence;
  free_text: string;
  suggested_improvement: string | null;
  expected_behaviour: string | null;
  reduces_educational_quality: boolean | null;
  usable_in_residency: boolean | null;
  scores: CqiQualityScores;
  would_recommend: boolean | null;
  annotations: CqiAnnotation[];
  transcript_window: CqiTranscriptTurn[];
  status: CqiStatus;
  cluster_id: string | null;
  fingerprint: string;
  platform_version: string | null;
  release_version: string | null;
  prompt_version: string | null;
  pme_version: string | null;
  disorder_slug: string | null;
  language: string | null;
  context: CqiCaptureContext | Record<string, unknown>;
  evidence: Record<string, unknown>;
  analyst_notes: Record<string, unknown>;
};

export type CqiCluster = {
  id: string;
  title: string;
  summary: string;
  category: string | null;
  severity: string | null;
  confidence_pct: number;
  report_count: number;
  fingerprint: string;
  affected_languages: string[];
  affected_disorders: string[];
  affected_voices: string[];
  affected_prompt_versions: string[];
  affected_releases: string[];
  affected_models: string[];
  root_cause: string | null;
  educational_impact: string | null;
  clinical_impact: string | null;
  effort_estimate: "xs" | "s" | "m" | "l" | "xl" | null;
  recommendation: string | null;
  status: string;
  engineering: CqiEngineeringRec | Record<string, unknown>;
};

export type CqiEngineeringRec = {
  title: string;
  root_cause: string;
  affected_files: string[];
  affected_subsystem: string;
  risk: string;
  priority: "p0" | "p1" | "p2" | "p3";
  regression_requirements: string;
  acceptance_criteria: string;
  github_issue_md: string;
  cursor_prompt: string;
  /** Explicit: never auto-create PRs or modify production. */
  requires_human_approval: true;
};

export type CqiDashboard = {
  cqi_version: string;
  generated_at: string;
  totals: {
    flags: number;
    clusters: number;
    critical: number;
    high: number;
    open_clusters: number;
  };
  by_category: Array<{ category: string; n: number }>;
  by_severity: Array<{ severity: string; n: number }>;
  by_disorder: Array<{ disorder: string; n: number; avg_clinical?: number }>;
  by_language: Array<{ language: string; n: number }>;
  top_clusters: Array<{
    title: string;
    report_count: number;
    severity: string | null;
    confidence_pct: number;
  }>;
  score_averages: {
    clinical_realism: number | null;
    conversation_realism: number | null;
    educational_usefulness: number | null;
    voice_realism: number | null;
    assessment_quality: number | null;
  };
  trends: {
    by_release: Array<{ release: string; n: number }>;
    by_prompt: Array<{ prompt: string; n: number }>;
  };
  residency_usable_rate: number | null;
  recommend_rate: number | null;
};

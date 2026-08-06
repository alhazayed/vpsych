/** Professional Preview Program — domain types. */

export const PPP_AGREEMENT_VERSION = "1.0";
export const PPP_INDICES_VERSION = "1.0.0";

export type Likert1to5 = 1 | 2 | 3 | 4 | 5;

export type CqiSeverity = "critical" | "high" | "medium" | "wishlist";

export type CqiCategory =
  | "clinical_realism"
  | "conversation"
  | "voice_tts"
  | "assessment"
  | "safety"
  | "ui_ux"
  | "bilingual"
  | "other";

export type EducationalOpportunityType =
  | "missed_teaching_moment"
  | "strong_teaching_moment"
  | "curriculum_gap"
  | "competency_focus"
  | "supervision_use_case"
  | "other";

export type FeatureRequestTheme =
  | "simulation"
  | "assessment"
  | "voice"
  | "curriculum"
  | "admin"
  | "bilingual"
  | "general";

export type BlindCondition = "ai_patient" | "human_sp" | "unknown";

export type PppReviewer = {
  id: string;
  profile_id: string;
  credentials: string | null;
  specialty: string | null;
  institution: string | null;
  cohort: string;
  agreement_version: string;
  agreement_accepted_at: string;
  invited_by: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PppSessionRating = {
  id: string;
  session_id: string;
  reviewer_id: string;
  clinical_realism: Likert1to5;
  educational_value: Likert1to5;
  conversation_naturalness: Likert1to5;
  therapeutic_alliance: Likert1to5;
  patient_believability: Likert1to5;
  learning_impact: Likert1to5;
  voice_realism: Likert1to5 | null;
  arabic_quality: Likert1to5 | null;
  english_quality: Likert1to5 | null;
  used_voice: boolean;
  session_language: string | null;
  free_text: string | null;
  created_at: string;
};

export type PppCqiReport = {
  id: string;
  reporter_id: string;
  session_id: string | null;
  severity: CqiSeverity;
  category: CqiCategory;
  title: string;
  description: string;
  status: "open" | "triaged" | "resolved" | "wont_fix";
  created_at: string;
  updated_at: string;
};

export type PppEducationalOpportunity = {
  id: string;
  reporter_id: string;
  session_id: string | null;
  opportunity_type: EducationalOpportunityType;
  competency_area: string | null;
  title: string;
  description: string;
  created_at: string;
};

export type PppFeatureRequest = {
  id: string;
  reporter_id: string;
  title: string;
  description: string;
  theme: FeatureRequestTheme;
  created_at: string;
};

export type PppBlindScore = {
  id: string;
  session_id: string | null;
  scorer_id: string;
  protocol_version: string;
  blind_condition: BlindCondition;
  overall_realism: Likert1to5;
  would_use_in_training: boolean | null;
  free_text: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Reviewer Analytics indices — all 0–100 when computable, else null. */
export type ReviewerAnalyticsIndices = {
  clinical_authenticity_index: number | null;
  educational_value_index: number | null;
  conversation_naturalness_index: number | null;
  therapeutic_alliance_score: number | null;
  patient_believability_score: number | null;
  learning_impact_score: number | null;
  voice_realism_score: number | null;
  arabic_quality_score: number | null;
  english_quality_score: number | null;
  sample_size: number;
  voice_sample_size: number;
  arabic_sample_size: number;
  english_sample_size: number;
  indices_version: string;
};

export type FeatureRequestThemeCount = {
  theme: string;
  count: number;
  sample_titles: string[];
};

export type PppDashboard = {
  reviewers: {
    total: number;
    active: number;
  };
  sessions: {
    started: number;
    completed: number;
    completion_rate_pct: number | null;
    avg_duration_sec: number | null;
    avg_duration_pct_of_max: number | null;
    avg_conversation_length: number | null;
  };
  ratings: {
    count: number;
    avg_realism: number | null;
    avg_educational_value: number | null;
  };
  issues: {
    total: number;
    by_severity: Record<CqiSeverity, number>;
    open: number;
  };
  educational_opportunities: {
    total: number;
    by_type: Record<string, number>;
  };
  feature_requests: {
    total: number;
    common: FeatureRequestThemeCount[];
  };
  blind_scores: {
    count: number;
    avg_overall_realism: number | null;
    would_use_pct: number | null;
  };
  indices: ReviewerAnalyticsIndices;
  generated_at: string;
  disclaimer: string;
};

/** Educational Opportunity Intelligence — teaching assets, never defects. */

export const EOI_VERSION = "1.0.0";

export const EOI_OPPORTUNITY_TYPES = [
  "teaching_enhancement",
  "clinical_realism",
  "conversation_improvement",
  "therapeutic_alliance",
  "assessment_improvement",
  "supervisor_feedback",
  "adaptive_learning",
  "scenario_variation",
  "osce_improvement",
  "competency_mapping",
  "reflection_opportunity",
  "communication_skills",
  "professionalism",
  "ethics",
  "cultural_competence",
  "patient_safety",
  "shared_decision_making",
  "evidence_based_practice",
  "other",
] as const;

export type EoiOpportunityType = (typeof EOI_OPPORTUNITY_TYPES)[number];

export const EOI_TARGET_LEARNERS = [
  "medical_student",
  "intern",
  "general_practitioner",
  "psychology_student",
  "psychologist",
  "psychiatry_resident",
  "consultant_psychiatrist",
  "counselor",
  "social_worker",
  "nurse",
] as const;

export type EoiTargetLearner = (typeof EOI_TARGET_LEARNERS)[number];

export const EOI_COMPETENCIES = [
  "rapport",
  "empathy",
  "mse",
  "risk_assessment",
  "dsm5",
  "icd11",
  "differential_diagnosis",
  "treatment_planning",
  "suicide_assessment",
  "communication",
  "professionalism",
  "documentation",
  "clinical_reasoning",
  "trauma_interviewing",
  "motivational_interviewing",
  "therapeutic_alliance",
  "cultural_competence",
  "ethics",
  "patient_safety",
  "shared_decision_making",
] as const;

export type EoiCompetency = (typeof EOI_COMPETENCIES)[number];

export const EOI_STATUSES = [
  "open",
  "under_review",
  "accepted",
  "scheduled",
  "implemented",
  "validated",
  "published",
  "declined",
] as const;

export type EoiStatus = (typeof EOI_STATUSES)[number];

/** Matches `eoi_attachments.kind` check constraint. */
export const EOI_ATTACHMENT_KINDS = [
  "screenshot",
  "screen_recording",
  "audio",
  "pdf",
  "image",
  "drawing",
  "other",
] as const;

export type EoiAttachmentKind = (typeof EOI_ATTACHMENT_KINDS)[number];

export type EoiAnnotation = {
  message_id?: string | null;
  role?: string;
  quote: string;
  note?: string;
};

export type EoiSubmission = {
  session_id: string;
  anonymous?: boolean;
  opportunity_type: EoiOpportunityType;
  educational_impact: number; // 1–5
  target_learners: EoiTargetLearner[];
  competencies: string[];
  idea_text: string;
  design_sketch?: string;
  expected_learning_experience?: string;
  annotations?: EoiAnnotation[];
  context: Record<string, unknown>;
  evidence?: Record<string, unknown>;
};

export type EoiOpportunityRow = {
  id: string;
  created_at: string;
  reviewer_id: string | null;
  anonymous: boolean;
  session_id: string | null;
  opportunity_type: EoiOpportunityType;
  educational_impact: number;
  target_learners: string[];
  competencies: string[];
  idea_text: string;
  design_sketch: string | null;
  expected_learning_experience: string | null;
  annotations: EoiAnnotation[];
  transcript_window: unknown[];
  status: EoiStatus;
  cluster_id: string | null;
  fingerprint: string;
  platform_version: string | null;
  release_version: string | null;
  prompt_version: string | null;
  language: string | null;
  disorder_slug: string | null;
  difficulty: string | null;
  context: Record<string, unknown>;
  evidence: Record<string, unknown>;
  analyst: Record<string, unknown>;
};

export type EoiRecommendation = {
  educational_rationale: string;
  expected_learner_benefit: string;
  affected_disorders: string[];
  affected_curriculum: string[];
  affected_competencies: string[];
  difficulty_level: string;
  estimated_effort: "xs" | "s" | "m" | "l" | "xl";
  educational_priority: "p0" | "p1" | "p2" | "p3";
  research_value: string;
  strategic_value: string;
  cursor_prompt: string;
  backlog_notes: string;
  requires_human_approval: true;
  is_defect: false;
};

export type EoiClusterDraft = {
  title: string;
  summary: string;
  opportunity_type: string | null;
  report_count: number;
  confidence_pct: number;
  fingerprint: string;
  educational_impact_avg: number;
  expected_benefit: string;
  target_learners: string[];
  competencies: string[];
  affected_disorders: string[];
  affected_languages: string[];
  affected_curriculum: string[];
  difficulty_level: string;
  educational_rationale: string;
  learner_benefit: string;
  research_value: string;
  effort_estimate: "xs" | "s" | "m" | "l" | "xl";
  educational_priority: "p0" | "p1" | "p2" | "p3";
  strategic_value: string;
  backlog_score: number;
  status: string;
  recommendation: EoiRecommendation;
  member_ids: string[];
};

export type EoiDashboard = {
  eoi_version: string;
  generated_at: string;
  totals: {
    opportunities: number;
    clusters: number;
    high_impact: number;
    accepted: number;
  };
  top_opportunities: Array<{
    title: string;
    report_count: number;
    educational_impact_avg: number;
    educational_priority: string;
    backlog_score: number;
  }>;
  by_type: Array<{ type: string; n: number }>;
  by_competency: Array<{ competency: string; n: number }>;
  by_learner: Array<{ learner: string; n: number }>;
  by_disorder: Array<{ disorder: string; n: number }>;
  backlog: Array<{
    title: string;
    backlog_score: number;
    educational_priority: string;
    effort_estimate: string;
    research_value: string;
  }>;
  trends: {
    by_release: Array<{ release: string; n: number }>;
  };
};

/** Institutional user feedback — independent of patient cognition. */

export const FEEDBACK_ROLE_PERSONAS = [
  "resident",
  "student",
  "supervisor",
  "faculty",
  "clinician",
  "researcher",
  "administrator",
  "institution",
] as const;

export type FeedbackRolePersona = (typeof FEEDBACK_ROLE_PERSONAS)[number];

export const FEEDBACK_CATEGORIES = [
  "clinical_realism",
  "educational_value",
  "conversation_quality",
  "voice_realtime",
  "assessment_report",
  "supervisor_tools",
  "enterprise_admin",
  "security_privacy",
  "bug",
  "critical_safety",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "wishlist",
] as const;

export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export type InstitutionalFeedback = {
  id: string;
  created_at: string;
  submitter_id: string | null;
  institution_id: string | null;
  role_persona: FeedbackRolePersona;
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  rating: number | null;
  body: string;
  session_id: string | null;
  locale: string | null;
  metadata: Record<string, unknown>;
};

export type FeedbackSubmitInput = {
  role_persona: FeedbackRolePersona;
  category: FeedbackCategory;
  severity?: FeedbackSeverity;
  rating?: number | null;
  body: string;
  session_id?: string | null;
  institution_id?: string | null;
  locale?: string | null;
  metadata?: Record<string, unknown>;
};

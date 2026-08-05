/**
 * Mission 22 — Clinical Validation & Human Authenticity Program (CVHAP)
 * Shared contracts for PAS / LAS / PAB / therapy-response / beta readiness.
 */

export const VALIDATION_PROGRAM_VERSION = "1.0.0";
export const PAS_VERSION = "1.0.0";
export const LAS_VERSION = "1.0.0";
export const PAB_VERSION = "1.0.0";

export type BlindArm = "pme_v1" | "legacy_prompt" | "standardized_patient" | "human_transcript";

export type RaterRole =
  | "consultant_psychiatrist"
  | "psychiatry_resident"
  | "clinical_psychologist"
  | "medical_student"
  | "gp"
  | "counselor";

/** 1–5 Likert used on all clinician/learner forms. */
export type Likert5 = 1 | 2 | 3 | 4 | 5;

export type PsychiatristRatingForm = {
  rater_id: string;
  rater_role: Extract<
    RaterRole,
    "consultant_psychiatrist" | "psychiatry_resident" | "clinical_psychologist"
  >;
  case_id: string;
  /** Blind: rater must not see these at rating time. */
  blinded: true;
  arm_unknown_to_rater: true;
  ratings: {
    clinical_realism: Likert5;
    diagnostic_authenticity: Likert5;
    emotional_authenticity: Likert5;
    consistency: Likert5;
    natural_conversation: Likert5;
    therapeutic_alliance: Likert5;
    interview_difficulty: Likert5;
    overall_realism: Likert5;
  };
  free_text?: string;
  would_use_for_teaching?: boolean;
  suspected_ai?: boolean | null;
  rated_at: string;
};

export type LearnerRatingForm = {
  rater_id: string;
  rater_role: Extract<
    RaterRole,
    "medical_student" | "psychiatry_resident" | "clinical_psychologist" | "gp" | "counselor"
  >;
  case_id: string;
  ratings: {
    immersion: Likert5;
    learning_value: Likert5;
    confidence_after: Likert5;
    diagnostic_reasoning: Likert5;
    interview_confidence: Likert5;
    perceived_realism: Likert5;
    educational_usefulness: Likert5;
  };
  free_text?: string;
  rated_at: string;
};

export type AuthenticityScoreResult = {
  overall: number;
  subscores: Array<{
    id: string;
    score: number;
    weight: number;
    weighted_contribution: number;
  }>;
  n_ratings: number;
  ci95: { lower: number; upper: number };
  version: string;
  computed_at: string;
  recommendations: string[];
};

export type TherapyStyleId =
  | "supportive"
  | "cbt"
  | "motivational_interviewing"
  | "dbt"
  | "psychodynamic"
  | "crisis";

export type TherapyResponseObservation = {
  style: TherapyStyleId;
  turns: number;
  trust_delta: number;
  alliance_delta: number;
  disclosure_mean_delta: number;
  hope_delta: number;
  resistance_proxy: number;
  gradual: boolean;
  clinically_plausible: boolean;
  notes: string[];
};

export type ConversationQualityFinding = {
  id: string;
  severity: "low" | "medium" | "high";
  locale: "en" | "ar" | "both";
  category:
    | "ai_wording"
    | "formal_language"
    | "repetition"
    | "textbook"
    | "transition"
    | "verbosity"
    | "literal_translation";
  evidence: string;
  remediation: string;
};

export type BetaVerdict =
  | "GO_TO_EXPERT_BETA"
  | "GO_TO_LIMITED_PILOT"
  | "CONDITIONAL_GO"
  | "NO_GO";

export type BetaReadinessAssessment = {
  version: string;
  assessed_at: string;
  domains: Array<{
    id: string;
    score: number;
    status: "ready" | "conditional" | "not_ready";
    evidence: string[];
    gaps: string[];
  }>;
  overall_score: number;
  verdict: BetaVerdict;
  recommended_participant_profile: string[];
  recommended_beta_size: { clinicians: number; learners: number; cases: number };
  success_criteria: string[];
  known_limitations: string[];
  risk_register: Array<{
    risk: string;
    likelihood: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    mitigation: string;
  }>;
  rationale: string;
};

/**
 * Clinical Validation Laboratory (CVL) — Mission 100
 * Scientific validation contracts. No fabricated evidence.
 */

export const CVL_VERSION = "1.0.0";
export const CVL_MIGRATION = "20260806011200";

/** Experimental arms — never revealed to blinded reviewers. */
export const CVL_ARMS = [
  "real_patient",
  "standardized_patient",
  "vpsych_avatar",
] as const;
export type CvlArm = (typeof CVL_ARMS)[number];

export const CVL_REVIEWER_TYPES = [
  "consultant_psychiatrist",
  "psychiatry_resident",
  "clinical_psychologist",
  "cbt_therapist",
  "general_practitioner",
  "medical_student",
] as const;
export type CvlReviewerType = (typeof CVL_REVIEWER_TYPES)[number];

export const CVL_STUDY_KINDS = [
  "blind_psychiatrist_challenge",
  "blind_therapy_challenge",
  "resident_education_study",
  "longitudinal_study",
  "human_conversation_fidelity",
  "assessment_accuracy",
] as const;
export type CvlStudyKind = (typeof CVL_STUDY_KINDS)[number];

export const CVL_STUDY_STATUSES = [
  "draft",
  "irb_pending",
  "recruiting",
  "active",
  "analysis",
  "completed",
  "archived",
] as const;
export type CvlStudyStatus = (typeof CVL_STUDY_STATUSES)[number];

/** Clinical Fidelity Level — stored in Quality Ledger. */
export const CLINICAL_FIDELITY_LEVELS = [
  "CFL-1",
  "CFL-2",
  "CFL-3",
  "CFL-4",
  "CFL-5",
] as const;
export type ClinicalFidelityLevel = (typeof CLINICAL_FIDELITY_LEVELS)[number];

export const CFL_DEFINITIONS: Record<ClinicalFidelityLevel, string> = {
  "CFL-1": "Technically coherent",
  "CFL-2": "Believable for students",
  "CFL-3": "Believable to psychiatrists in transcript review",
  "CFL-4": "Believable in blinded live interaction",
  "CFL-5":
    "Educationally equivalent or superior to standardized patients for defined learning objectives",
};

export type Likert5 = 1 | 2 | 3 | 4 | 5;

/** Module 1 — Blind Psychiatrist Challenge rating dimensions. */
export type BpcRatingDimensions = {
  clinical_realism: Likert5;
  emotional_realism: Likert5;
  diagnostic_consistency: Likert5;
  speech_naturalness: Likert5;
  thought_process: Likert5;
  affect: Likert5;
  rapport: Likert5;
  therapeutic_alliance: Likert5;
  disclosure_timing: Likert5;
  resistance: Likert5;
  educational_usefulness: Likert5;
};

export type BpcRatingSubmission = {
  study_id: string;
  assignment_id: string;
  reviewer_token: string; // opaque; identity never exposed in exports by default
  reviewer_type: CvlReviewerType;
  modality: "transcript" | "live_session" | "multi_session";
  ratings: BpcRatingDimensions;
  would_teach_with_case: boolean | null;
  believed_arm: CvlArm | "unsure" | null;
  confidence_pct: number; // 0–100
  free_comments?: string;
  teaching_opportunities?: string;
  quality_concerns?: string;
  rated_at: string;
};

/** Module 2 — Blind Therapy Challenge. */
export type BtcRatingSubmission = {
  study_id: string;
  assignment_id: string;
  reviewer_token: string;
  reviewer_type: CvlReviewerType;
  ratings: {
    alliance: Likert5;
    communication: Likert5;
    clinical_consistency: Likert5;
    educational_realism: Likert5;
    session_progression: Likert5;
    therapy_quality: Likert5;
  };
  final_diagnosis_guess?: string;
  believed_is_ai: boolean | null;
  confidence_pct: number;
  free_comments?: string;
  rated_at: string;
};

/** Module 3 — Resident education outcomes (per learner). */
export type EducationOutcomeRow = {
  study_id: string;
  learner_token: string;
  group: "traditional" | "vpsych";
  osce: number | null;
  mse: number | null;
  dsm_diagnosis: number | null;
  icd_diagnosis: number | null;
  risk_assessment: number | null;
  empathy: number | null;
  documentation: number | null;
  retention: number | null;
  supervisor_rating: number | null;
  time_to_competency_days: number | null;
  recorded_at: string;
};

/** Module 4 — Longitudinal session measures. */
export type LongitudinalMeasureRow = {
  study_id: string;
  case_instance_id: string;
  session_index: number; // 1..10+
  memory: number | null;
  life_events: number | null;
  alliance: number | null;
  treatment_response: number | null;
  trust: number | null;
  disclosure: number | null;
  clinical_progression: number | null;
  recorded_at: string;
};

/** Module 5 — HCF checklist scores (0–100 per facet). */
export type HcfFacetScores = {
  naturalness: number;
  interruptions: number;
  repair: number;
  silence: number;
  hesitation: number;
  emotion: number;
  deflection: number;
  contradiction: number;
  topic_switching: number;
  language_fit: number;
  speech_tempo: number;
  thought_disorder: number;
  affect: number;
};

export type HcfEvaluationRow = {
  study_id: string;
  case_ref: string;
  disorder_slug: string;
  locale: "en" | "ar" | "both";
  facets: HcfFacetScores;
  overall: number;
  rater_token: string;
  rated_at: string;
};

/** Assessment accuracy — expert clinician scores vs platform scores (paired). */
export type AssessmentAccuracyRow = {
  study_id: string;
  case_ref: string;
  disorder_slug: string;
  expert_scores: Record<string, number>;
  platform_scores: Record<string, number>;
  absolute_error: number | null;
  correlation: number | null;
  rater_token: string;
  notes?: string;
  rated_at: string;
};

export type CvlStudy = {
  id: string;
  created_at: string;
  updated_at: string;
  kind: CvlStudyKind;
  title: string;
  status: CvlStudyStatus;
  protocol_version: string;
  irb_reference: string | null;
  arms: CvlArm[];
  target_reviewer_types: CvlReviewerType[];
  disorder_slugs: string[];
  preregistration: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type CvlAssignment = {
  id: string;
  study_id: string;
  reviewer_token: string;
  reviewer_type: CvlReviewerType;
  /** Ground truth — never returned to reviewer endpoints. */
  arm: CvlArm;
  case_ref: string;
  disorder_slug: string | null;
  modality: string;
  block_id: string | null;
  created_at: string;
};

export type CvlMetricId =
  | "CRI"
  | "HCFI"
  | "TAI"
  | "PCI"
  | "EEI"
  | "DFI"
  | "LCI"
  | "CFL";

export type CvlMetricResult = {
  metric_id: CvlMetricId;
  score: number | null;
  n: number;
  ci95: { lower: number; upper: number } | null;
  insufficient_data: boolean;
  evidence_refs: string[];
  computed_at: string;
  algorithm_version: string;
};

export type CflRecord = {
  id: string;
  case_ref: string;
  disorder_slug: string | null;
  level: ClinicalFidelityLevel;
  rationale: string[];
  evidence_refs: string[];
  metrics: Partial<Record<CvlMetricId, number | null>>;
  computed_at: string;
  ledger_ref: string | null;
  human_approved: boolean;
};

export type CvlRoadmapItem = {
  priority: "p0" | "p1" | "p2" | "p3";
  title: string;
  educational_impact: string;
  clinical_impact: string;
  research_impact: string;
  implementation_effort: "xs" | "s" | "m" | "l" | "xl";
  expected_fidelity_improvement: string;
  evidence_refs: string[];
};

export type CvlDashboard = {
  cvl_version: string;
  generated_at: string;
  studies: Array<{
    id: string;
    title: string;
    kind: CvlStudyKind;
    status: CvlStudyStatus;
    n_assignments: number;
    n_ratings: number;
  }>;
  metrics: CvlMetricResult[];
  cfl_distribution: Array<{ level: ClinicalFidelityLevel; n: number }>;
  by_disorder: Array<{
    disorder: string;
    cri: number | null;
    hcfi: number | null;
    cfl: ClinicalFidelityLevel | null;
    n: number;
  }>;
  reviewer_agreement: {
    icc: number | null;
    n_raters: number;
    n_items: number;
    insufficient_data: boolean;
  };
  roadmap: CvlRoadmapItem[];
  notes: string[];
};

/**
 * Adaptive Curriculum Engine (ACE) v3.0 — TypeScript contracts.
 */

import type { CaseDifficulty } from "@/lib/case-engine/types";

export type AceTrainingLevel =
  | "undergraduate"
  | "postgraduate"
  | "residency"
  | "fellowship"
  | "continuing_education"
  | "certification_track";

export type AceProfession =
  | "medical_student"
  | "psychiatry_resident"
  | "psychologist"
  | "clinical_psychologist"
  | "counselor"
  | "general_practitioner"
  | "family_physician"
  | "emergency_physician"
  | "internal_medicine_resident"
  | "nurse_practitioner"
  | "psychiatric_nurse"
  | "social_worker"
  | "occupational_therapist"
  | "medical_educator"
  | "osce_candidate"
  | "other";

export type AceCurriculumMode = "automatic" | "manual" | "hybrid";

export type AceCertificationStatus =
  | "not_started"
  | "in_progress"
  | "eligible"
  | "certified"
  | "expired";

export type CompetencyId =
  | "diagnostic_interview"
  | "mental_status_examination"
  | "dsm5_reasoning"
  | "icd11_reasoning"
  | "differential_diagnosis"
  | "risk_assessment"
  | "suicide_assessment"
  | "violence_assessment"
  | "medication_management"
  | "cbt_skills"
  | "dbt_skills"
  | "act_skills"
  | "motivational_interviewing"
  | "psychodynamic_interviewing"
  | "supportive_therapy"
  | "therapeutic_alliance"
  | "empathy"
  | "psychoeducation"
  | "treatment_planning"
  | "documentation"
  | "professional_communication"
  | "time_management"
  | "ethical_decision_making"
  | "cultural_competence"
  | "family_interviewing"
  | "emergency_psychiatry";

export type CompetencyDomain = {
  id: CompetencyId;
  label: string;
  description: string;
  category: string;
  sort_order: number;
};

export type LearnerCompetency = {
  competency_id: CompetencyId;
  score: number; // 0–100
  samples: number;
  trend: number;
  last_assessed_at?: string | null;
  mastered_at?: string | null;
};

export type LearnerProfile = {
  id: string;
  user_id: string;
  training_level: AceTrainingLevel;
  profession: AceProfession;
  institution?: string | null;
  language: string;
  preferred_therapy_models: string[];
  adaptive_mode: boolean;
  curriculum_mode: AceCurriculumMode;
  min_competency_threshold: number;
  max_difficulty: CaseDifficulty;
  locked_diagnoses: string[];
  locked_objectives: string[];
  required_competencies: CompetencyId[];
  optional_competencies: CompetencyId[];
  completed_case_count: number;
  learning_velocity: number;
  confidence_score: number;
  certification_status: AceCertificationStatus;
  competencies: LearnerCompetency[];
  metadata?: Record<string, unknown>;
};

export type PerformanceMissFlags = {
  missed_suicide_questions?: boolean;
  missed_violence_assessment?: boolean;
  missed_substance_screening?: boolean;
  missed_trauma_assessment?: boolean;
  missed_bipolar_screening?: boolean;
  missed_psychosis_screening?: boolean;
  missed_dsm_criteria?: boolean;
  missed_icd_criteria?: boolean;
  incorrect_medications?: boolean;
  incorrect_formulation?: boolean;
};

export type SessionPerformanceInput = {
  sessionId?: string;
  overallScore: number; // 0–100
  /** Map competency → 0–100 from rubric / heuristics */
  competencyScores: Partial<Record<CompetencyId, number>>;
  diagnosisSlug?: string | null;
  correctDiagnosis?: boolean;
  missFlags?: PerformanceMissFlags;
  empathy?: number;
  alliance?: number;
  communication?: number;
  documentation?: number;
  timeManagement?: number;
  durationSec?: number;
  timeLimitSec?: number;
};

export type AdaptiveAdaptation = {
  focus: CompetencyId[];
  diagnosis_pool?: string[];
  si_styles?: string[];
  adaptations?: string[];
  increase?: string[];
  reduce?: string[];
  difficulty_delta?: number;
  hold_therapy_complexity?: boolean;
  reduce_unrelated_complexity?: boolean;
  feedback_mode?: string;
  allow_hints?: boolean;
  preset_slugs?: string[];
  require_high?: Array<{ competency: CompetencyId; min: number }>;
  require_velocity_min?: number;
};

export type AdaptiveRule = {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  trigger_competency_id: CompetencyId;
  trigger_operator: "lt" | "lte" | "gt" | "gte" | "between";
  trigger_threshold: number;
  trigger_threshold_high?: number | null;
  adaptation: AdaptiveAdaptation;
  priority: number;
  enabled: boolean;
};

export type CurriculumStep = {
  index: number;
  title: string;
  focus: CompetencyId[];
  diagnosis_slug?: string;
  difficulty: CaseDifficulty;
  risk_style?: string;
  si_style?: string;
  adaptations?: string[];
  preset_slug?: string;
  time_limit_minutes?: number;
  completed?: boolean;
};

export type LearningPath = {
  id: string;
  learner_id: string;
  slug: string;
  name: string;
  focus_competency_id: CompetencyId | null;
  status: "active" | "completed" | "paused" | "archived";
  steps: CurriculumStep[];
  current_step: number;
};

export type AdaptiveCaseRequest = {
  presetSlug?: string;
  disorderSlug?: string;
  comorbiditySlugs?: string[];
  difficulty: CaseDifficulty;
  therapyModality?: string;
  focusCompetencies: CompetencyId[];
  adaptations: string[];
  siStyle?: string;
  timeLimitMinutes?: number;
  allowHints?: boolean;
  feedbackMode?: string;
  rationale: string;
  fingerprint: string;
};

export type CoachFeedback = {
  supervisor_feedback: string;
  reflective_questions: string[];
  missed_opportunities: string[];
  suggested_reading: string[];
  suggested_next_cases: string[];
  learning_goals: string[];
  improvement_plan: string;
};

export type CertificationBadge = {
  badge_slug: string;
  title: string;
  competency_id: CompetencyId;
  threshold: number;
  min_samples: number;
};

export type PerformanceAnalytics = {
  learner_id: string;
  radar: Array<{ competency_id: CompetencyId; score: number }>;
  strengths: CompetencyId[];
  weaknesses: CompetencyId[];
  blind_spots: CompetencyId[];
  learning_curve: Array<{ n: number; overall: number }>;
  completed_diagnoses: string[];
  missed_diagnoses: string[];
  learning_velocity: number;
  confidence_score: number;
  certification_readiness: number;
  certification_status: AceCertificationStatus;
};

export type LearningPlan = {
  learner_id: string;
  primary_focus: CompetencyId | null;
  goals: string[];
  next_cases: AdaptiveCaseRequest[];
  reading: string[];
  estimated_sessions_to_threshold: number;
};

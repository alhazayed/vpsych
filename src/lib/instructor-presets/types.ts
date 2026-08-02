/**
 * Instructor Preset Engine — TypeScript contracts (v2.0).
 * Educators configure objectives; the engine selects diagnosis + template.
 */

import type {
  CaseDifficulty,
  TherapyModality,
} from "@/lib/case-engine/types";
import type {
  AssessmentType,
  ClinicalSpecialty,
  RandomizationLevel,
} from "@/lib/scenario-templates/types";

export type TargetLearner =
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
  | "osce_candidate";

export type LearningLevel =
  | "undergraduate"
  | "postgraduate"
  | "residency"
  | "fellowship"
  | "continuing_education";

export type GradingMode =
  | "practice"
  | "exam"
  | "certification"
  | "osce"
  | "supervisor_review"
  | "research";

export type FeedbackMode =
  | "realtime_coaching"
  | "end_of_session"
  | "supervisor_only"
  | "none";

export type LearningObjectiveKey =
  | "diagnostic_interview"
  | "mental_status_examination"
  | "risk_assessment"
  | "suicide_assessment"
  | "violence_risk_assessment"
  | "differential_diagnosis"
  | "medication_review"
  | "medication_counseling"
  | "medication_side_effects"
  | "cbt_skills"
  | "dbt_skills"
  | "act_skills"
  | "psychodynamic_interview"
  | "motivational_interviewing"
  | "supportive_psychotherapy"
  | "trauma_assessment"
  | "substance_use_assessment"
  | "adhd_assessment"
  | "autism_assessment"
  | "personality_assessment"
  | "family_assessment"
  | "breaking_bad_news"
  | "shared_decision_making"
  | "psychoeducation"
  | "treatment_planning"
  | "termination_session"
  | "relapse_prevention"
  | "crisis_intervention"
  | "emergency_psychiatry"
  | "osce_examination";

export const LEARNING_OBJECTIVES: LearningObjectiveKey[] = [
  "diagnostic_interview",
  "mental_status_examination",
  "risk_assessment",
  "suicide_assessment",
  "violence_risk_assessment",
  "differential_diagnosis",
  "medication_review",
  "medication_counseling",
  "medication_side_effects",
  "cbt_skills",
  "dbt_skills",
  "act_skills",
  "psychodynamic_interview",
  "motivational_interviewing",
  "supportive_psychotherapy",
  "trauma_assessment",
  "substance_use_assessment",
  "adhd_assessment",
  "autism_assessment",
  "personality_assessment",
  "family_assessment",
  "breaking_bad_news",
  "shared_decision_making",
  "psychoeducation",
  "treatment_planning",
  "termination_session",
  "relapse_prevention",
  "crisis_intervention",
  "emergency_psychiatry",
  "osce_examination",
];

export const TARGET_LEARNERS: TargetLearner[] = [
  "medical_student",
  "psychiatry_resident",
  "psychologist",
  "clinical_psychologist",
  "counselor",
  "general_practitioner",
  "family_physician",
  "emergency_physician",
  "internal_medicine_resident",
  "nurse_practitioner",
  "psychiatric_nurse",
  "social_worker",
  "occupational_therapist",
  "medical_educator",
  "osce_candidate",
];

export const PRESET_TIME_LIMITS = [10, 20, 30, 40, 45, 60, 90] as const;

export type PresetTimeLimit = 10 | 20 | 30 | 40 | 45 | 60 | 90;

export type PresetCompetency = {
  competency_id: string;
  label: string;
  required: boolean;
  weight: number;
  max_score: number;
};

export type PresetConstraint = {
  constraint_type:
    | "allowed_disorder"
    | "excluded_disorder"
    | "min_age"
    | "max_age"
    | "required_locale"
    | "forbidden_comorbidity"
    | "require_medical_sim";
  value: string;
};

export type PresetGradingConfig = {
  pass_threshold: number;
  outstanding_threshold: number;
  critical_mistakes: string[];
  automatic_deductions: Record<string, number>;
  dimensions: string[];
  report_sections: string[];
};

export type InstructorPreset = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  specialty: ClinicalSpecialty;
  target_learner: TargetLearner;
  learning_level: LearningLevel;
  clinical_rotation?: string | null;
  assessment_type: AssessmentType;
  primary_objective: LearningObjectiveKey;
  secondary_objectives: LearningObjectiveKey[];
  difficulty: CaseDifficulty;
  time_limit_minutes: PresetTimeLimit;
  language: string;
  culture?: string | null;
  therapy_modality: TherapyModality | "medication_management";
  randomization_level: RandomizationLevel;
  grading_mode: GradingMode;
  feedback_mode: FeedbackMode;
  voice_enabled: boolean;
  assessment_enabled: boolean;
  record_session: boolean;
  allow_hints: boolean;
  allow_pause: boolean;
  allow_restart: boolean;
  advanced_mode: boolean;
  scenario_template_id?: string | null;
  scenario_template_slug?: string | null;
  preferred_template_slugs: string[];
  clinical_constraints: PresetConstraint[];
  required_competencies: PresetCompetency[];
  optional_competencies: PresetCompetency[];
  grading: PresetGradingConfig;
  enabled: boolean;
  version: number;
};

/** Selection result before patient generation. */
export type PresetResolution = {
  preset: InstructorPreset;
  selectedDisorderSlug: string;
  selectedTemplateSlug: string;
  comorbiditySlugs: string[];
  rationale: string;
};

/**
 * VPsych Dynamic Clinical Case Engine — TypeScript contracts (v2.0).
 * Personas never permanently own a psychiatric disorder.
 */

import type { ClinicalCore, RubricItem } from "@/lib/types";

export type CaseDifficulty = "beginner" | "intermediate" | "advanced" | "expert";

export type TherapyModality =
  | "cbt"
  | "dbt"
  | "act"
  | "psychodynamic"
  | "supportive"
  | "motivational_interviewing"
  | "family_therapy"
  | "crisis_intervention"
  | "exposure_therapy";

/** Runtime clinical_core severity (DB CHECK + ClinicalCore). */
export type CaseSeverity = "subclinical" | "mild" | "moderate" | "severe";

export type ComorbidityTier = "compatible" | "possible" | "rare" | "impossible";

/** Module 1 — stable identity (locale-neutral baseline). */
export type PersonaIdentityModule = {
  age: number;
  gender: "female" | "male" | "non-binary" | "unspecified";
  occupation_baseline?: string;
  education_baseline?: string;
  nationality?: string;
  religion?: string;
  culture_baseline?: string;
  family_baseline?: string;
  communication_style?: string;
  personality_traits?: string[];
  attachment_style?: string;
  values?: string[];
  lifestyle?: string;
  hobbies?: string[];
  appearance?: string;
  speech_style_baseline?: string;
  nonverbal_baseline?: string;
  source?: string;
};

export type PersonaRow = {
  id: string;
  avatar_id: string | null;
  slug: string;
  display_name: string;
  identity: PersonaIdentityModule;
  traits: Record<string, unknown>;
  baseline_history: Record<string, unknown>;
  default_disorder_id: string | null;
  is_active: boolean;
};

/** Module 2 — diagnosis-specific package. */
export type DisorderPackage = {
  severity_default?: CaseSeverity;
  symptom_domains?: string[];
  risk_defaults?: {
    suicidal_ideation?: ClinicalCore["risk_profile"]["suicidal_ideation"];
    self_harm?: boolean;
    harm_to_others?: boolean;
    substance_use?: boolean;
    escalation_rules?: string;
  };
  differentials?: string[];
  rule_outs?: string[];
  teaching_points?: string[];
  common_therapist_mistakes?: string[];
  session_goals?: string[];
  ideal_approach?: string;
  symptom_profile?: ClinicalCore["symptom_profile"];
  disclosure_rules?: ClinicalCore["disclosure_rules"];
  /** Optional full clinical_core override template fields. */
  clinical_core_template?: Partial<ClinicalCore>;
  /** When true, missing DSM-5 is allowed (e.g. ICD-11-only Complex PTSD). */
  dsm5_optional?: boolean;
};

export type DisorderRow = {
  id: string;
  slug: string;
  name: string;
  dsm5_code: string | null;
  icd10_code: string | null;
  icd11_code: string | null;
  category: string | null;
  min_age: number | null;
  max_age: number | null;
  allowed_genders: string[];
  package: DisorderPackage;
  is_active: boolean;
};

export type ComorbidityRule = {
  id?: string;
  primary_disorder_id: string;
  comorbid_disorder_id: string;
  compatible: boolean;
  tier?: ComorbidityTier;
  notes?: string | null;
};

export type DifficultyModifiers = {
  insight: string;
  resistance: string;
  disclosure: string;
  diagnostic_ambiguity: string;
  alliance: string;
  masking: string;
  comorbidity_weight: number;
};

export type DifficultyProfile = {
  id: string;
  slug: string;
  level: CaseDifficulty;
  label: string;
  modifiers: DifficultyModifiers;
  is_active: boolean;
};

export type TherapyProfile = {
  id: string;
  slug: string;
  modality: TherapyModality;
  label: string;
  patient_reaction_rules: Record<string, unknown>;
  is_active: boolean;
};

/** Safe randomization — never mutates DSM criteria. */
export type RandomizedContext = {
  recent_stressor: string;
  financial_situation: string;
  relationship_detail: string;
  minor_life_event: string;
  timeline_offset_weeks: number;
  occupation_variant?: string;
};

export type CaseGenerationRequest = {
  persona: PersonaRow;
  avatarId: string;
  primaryDisorder: DisorderRow;
  comorbidities?: DisorderRow[];
  difficulty: CaseDifficulty;
  therapyModality: TherapyModality;
  locale: string;
  severity?: CaseSeverity;
  /** Optional seed for deterministic tests. */
  seed?: string | number;
  therapyProfile?: TherapyProfile;
  difficultyProfile?: DifficultyProfile;
  /** Legacy clinical_core from avatar — used when disorder package is thin. */
  legacyClinicalCore?: ClinicalCore | null;
  voiceProfileId?: string | null;
  createdBy?: string | null;
};

/** Immutable CaseInstance snapshot stored on sessions.clinical_snapshot. */
export type CaseInstanceSnapshot = {
  version: 2;
  assessment_id: string;
  case_instance_id?: string;
  persona: {
    id: string;
    slug: string;
    display_name: string;
    avatar_id: string;
  };
  primary_diagnosis: {
    id: string;
    slug: string;
    name: string;
    dsm5_code: string | null;
    icd10_code: string | null;
    icd11_code: string | null;
  };
  comorbidities: Array<{
    id: string;
    slug: string;
    name: string;
    dsm5_code: string | null;
    icd11_code: string | null;
  }>;
  difficulty: CaseDifficulty;
  difficulty_modifiers: DifficultyModifiers;
  therapy_modality: TherapyModality;
  therapy_reaction_rules: Record<string, unknown>;
  locale: string;
  severity: CaseSeverity;
  clinical_core: ClinicalCore;
  randomized_context: RandomizedContext;
  rubric?: RubricItem[];
  memory_scope: "case_instance";
  generated_at: string;
  /** Present when generated from a Clinical Scenario Template. */
  template?: {
    id: string;
    slug: string;
    version: number;
    name: string;
    specialty: string;
    assessment_type: string;
    culture?: string | null;
    risk_level?: string;
    grading_rubric?: Record<string, unknown>;
    learning_objectives?: unknown[];
    report_template?: Record<string, unknown>;
    memory_mode?: string;
  };
  /** Present when generated from an Instructor Preset. */
  instructor_preset?: {
    id: string;
    slug: string;
    version: number;
    name: string;
    primary_objective: string;
    secondary_objectives: string[];
    target_learner: string;
    assessment_type: string;
    grading_mode: string;
    feedback_mode: string;
    time_limit_minutes: number;
    allow_hints: boolean;
    allow_pause: boolean;
    allow_restart: boolean;
    voice_enabled: boolean;
    culture?: string | null;
    pacing?: Record<string, string>;
    rationale?: string;
  };
};

export type CaseValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type CaseValidationResult =
  | { ok: true }
  | { ok: false; issues: CaseValidationIssue[] };

export type CaseEngineCatalog = {
  disorders: DisorderRow[];
  comorbidityRules: ComorbidityRule[];
  difficultyProfiles: DifficultyProfile[];
  therapyProfiles: TherapyProfile[];
};

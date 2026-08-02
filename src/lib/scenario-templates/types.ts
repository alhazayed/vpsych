/**
 * Clinical Scenario Template Engine — TypeScript contracts (v2.0).
 */

import type {
  CaseDifficulty,
  CaseSeverity,
  TherapyModality,
} from "@/lib/case-engine/types";
import type { RubricItem } from "@/lib/types";

export type ClinicalSpecialty =
  | "general_adult_psychiatry"
  | "child_psychiatry"
  | "addiction_psychiatry"
  | "consultation_liaison_psychiatry"
  | "geriatric_psychiatry"
  | "forensic_psychiatry"
  | "primary_care_mental_health"
  | "clinical_psychology"
  | "counselling"
  | "social_work"
  | "emergency_psychiatry";

export type AssessmentType =
  | "initial_assessment"
  | "follow_up"
  | "risk_assessment"
  | "medication_review"
  | "cbt_session"
  | "dbt_session"
  | "psychodynamic_session"
  | "crisis_intervention"
  | "family_session"
  | "termination_session"
  | "osce_examination";

export type TemplateSeverity =
  | "minimal"
  | "mild"
  | "moderate"
  | "severe"
  | "very_severe";

export type RiskLevel = "none" | "low" | "moderate" | "high" | "imminent";

export type RandomizationLevel = "none" | "low" | "moderate" | "high";

export type MemoryMode = "case_isolated" | "longitudinal";

export type ComorbidityTier = "compatible" | "possible" | "rare" | "impossible";

export type ObjectiveCategory =
  | "skills"
  | "knowledge"
  | "clinical_competency"
  | "communication"
  | "risk"
  | "documentation"
  | "dsm_reasoning"
  | "icd_reasoning"
  | "differential_diagnosis"
  | "therapeutic_alliance";

export type GradingRubricConfig = {
  pass_threshold: number;
  outstanding_threshold: number;
  critical_mistakes?: string[];
  automatic_deductions?: Record<string, number>;
  excellent_markers?: string[];
};

export type TemplateObjective = {
  id?: string;
  category: ObjectiveCategory;
  statement: string;
  sort_order?: number;
};

export type TemplateCompetency = {
  id?: string;
  competency_id: string;
  label: string;
  weight: number;
  max_score: number;
  critical?: boolean;
  auto_deduction?: number;
  excellent_marker?: string;
  sort_order?: number;
};

export type ClinicalScenarioTemplate = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  specialty: ClinicalSpecialty;
  target_learners: string[];
  estimated_duration_minutes: number;
  difficulty: CaseDifficulty;
  language: string;
  culture?: string | null;
  therapy_modality: TherapyModality | "exposure_therapy";
  primary_diagnosis_id: string;
  primary_diagnosis_slug?: string;
  allowed_comorbidity_slugs: string[];
  excluded_diagnosis_slugs: string[];
  severity: TemplateSeverity;
  risk_level: RiskLevel;
  assessment_type: AssessmentType;
  voice_profile_id?: string | null;
  default_persona_id?: string | null;
  default_persona_slug?: string | null;
  randomization_level: RandomizationLevel;
  memory_mode: MemoryMode;
  grading_rubric: GradingRubricConfig;
  report_template: Record<string, unknown>;
  learning_objectives: TemplateObjective[];
  clinical_competencies: TemplateCompetency[];
  allow_medical_simulation?: boolean;
  enabled: boolean;
  version: number;
};

/** Map template severity → clinical_core severity (very_severe→severe, minimal→subclinical). */
export function templateSeverityToCaseSeverity(
  s: TemplateSeverity,
): NonNullable<import("@/lib/types").ClinicalCore["severity"]> {
  if (s === "minimal") return "subclinical";
  if (s === "very_severe") return "severe";
  return s;
}

export function competenciesToRubricItems(
  competencies: TemplateCompetency[],
): RubricItem[] {
  return competencies.map((c) => ({
    id: c.competency_id,
    label: c.label,
    weight: Number(c.weight) || 1,
    max: Number(c.max_score) || 5,
  }));
}

/**
 * Educational Outcomes — profession journeys, growth, reliability, retention.
 */

import type { AceProfession, AceTrainingLevel, CompetencyId } from "@/lib/ace/types";

export type AbilityTier = "weak" | "average" | "excellent";

export type ProfessionJourneySpec = {
  profession: AceProfession;
  training_level: AceTrainingLevel;
  label: string;
  /** Primary competencies this role must grow. */
  focus: CompetencyId[];
  /** Secondary clinical reasoning competencies. */
  reasoning: CompetencyId[];
};

export const PROFESSION_JOURNEYS: ProfessionJourneySpec[] = [
  {
    profession: "medical_student",
    training_level: "undergraduate",
    label: "Medical Student",
    focus: [
      "diagnostic_interview",
      "mental_status_examination",
      "risk_assessment",
      "professional_communication",
    ],
    reasoning: ["dsm5_reasoning", "differential_diagnosis"],
  },
  {
    profession: "psychiatry_resident",
    training_level: "residency",
    label: "Psychiatry Resident",
    focus: [
      "suicide_assessment",
      "differential_diagnosis",
      "medication_management",
      "emergency_psychiatry",
    ],
    reasoning: ["dsm5_reasoning", "icd11_reasoning", "treatment_planning"],
  },
  {
    profession: "psychologist",
    training_level: "postgraduate",
    label: "Psychologist",
    focus: [
      "cbt_skills",
      "therapeutic_alliance",
      "empathy",
      "motivational_interviewing",
    ],
    reasoning: ["differential_diagnosis", "psychoeducation"],
  },
  {
    profession: "general_practitioner",
    training_level: "continuing_education",
    label: "General Practitioner",
    focus: [
      "diagnostic_interview",
      "risk_assessment",
      "medication_management",
      "suicide_assessment",
    ],
    reasoning: ["differential_diagnosis", "dsm5_reasoning"],
  },
  {
    profession: "counselor",
    training_level: "certification_track",
    label: "Counselor",
    focus: [
      "therapeutic_alliance",
      "empathy",
      "supportive_therapy",
      "motivational_interviewing",
    ],
    reasoning: ["psychoeducation", "professional_communication"],
  },
];

/** Baseline skill + learning rate by ability tier. */
export const TIER_PARAMS: Record<
  AbilityTier,
  {
    startOverall: number;
    learnRate: number;
    noise: number;
    ceiling: number;
    focusStart: number;
  }
> = {
  weak: {
    startOverall: 38,
    learnRate: 0.55,
    noise: 6,
    ceiling: 78,
    focusStart: 32,
  },
  average: {
    startOverall: 55,
    learnRate: 0.7,
    noise: 5,
    ceiling: 88,
    focusStart: 50,
  },
  excellent: {
    startOverall: 78,
    learnRate: 0.45,
    noise: 4,
    ceiling: 98,
    focusStart: 82,
  },
};

export const MIN_SESSIONS_PER_LEARNER = 50;

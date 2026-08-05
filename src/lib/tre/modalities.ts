/**
 * Evidence-informed modality effect profiles (educational simulation — not RCT claims).
 */

import type { TreModality, TreatmentOutcomes } from "@/lib/tre/types";

export type ModalityProfile = {
  id: TreModality;
  label: string;
  /** Primary channels this modality moves when competence + alliance are adequate. */
  strengths: Array<keyof TreatmentOutcomes>;
  /** Relative efficacy multipliers by disorder category (default 1). */
  category_fit: Record<string, number>;
  /** Max beneficial symptom reduction per session under ideal conditions. */
  max_symptom_relief: number;
  /** Risk of alliance rupture / disengagement if competence low. */
  low_skill_harm: number;
  clinical_note: string;
};

export const MODALITY_PROFILES: Record<TreModality, ModalityProfile> = {
  supportive: {
    id: "supportive",
    label: "Supportive Psychotherapy",
    strengths: ["trust", "hope", "engagement", "disclosure_openness"],
    category_fit: {
      mood: 1.1,
      anxiety: 1.0,
      trauma: 1.05,
      psychosis: 1.15,
      psychotic: 1.15,
      personality: 1.0,
      substance: 0.95,
      medical: 1.05,
      neurodevelopmental: 1.0,
    },
    max_symptom_relief: 4,
    low_skill_harm: 2,
    clinical_note:
      "Stabilizes alliance and hope; modest symptom change; foundation for other work.",
  },
  cbt: {
    id: "cbt",
    label: "Cognitive Behavioural Therapy",
    strengths: ["cognition", "symptoms", "functioning", "homework_adherence", "insight"],
    category_fit: {
      mood: 1.25,
      anxiety: 1.3,
      trauma: 1.05,
      ocd: 1.2,
      substance: 1.05,
      personality: 0.9,
      psychosis: 0.85,
      psychotic: 0.85,
      neurodevelopmental: 1.05,
      medical: 0.7,
    },
    max_symptom_relief: 7,
    low_skill_harm: 4,
    clinical_note:
      "Targets cognitions and behavioural activation; needs alliance + homework engagement.",
  },
  dbt: {
    id: "dbt",
    label: "Dialectical Behaviour Therapy",
    strengths: [
      "emotion_regulation",
      "engagement",
      "functioning",
      "relapse_risk",
      "trust",
    ],
    category_fit: {
      personality: 1.35,
      trauma: 1.15,
      mood: 1.0,
      substance: 1.05,
      anxiety: 0.95,
      psychotic: 0.9,
    },
    max_symptom_relief: 6,
    low_skill_harm: 5,
    clinical_note:
      "Emotion regulation and validation/change dialectic; strong fit for BPD-spectrum.",
  },
  motivational_interviewing: {
    id: "motivational_interviewing",
    label: "Motivational Interviewing",
    strengths: ["engagement", "homework_adherence", "insight", "hope"],
    category_fit: {
      substance: 1.4,
      mood: 1.05,
      anxiety: 1.0,
      personality: 1.0,
    },
    max_symptom_relief: 3,
    low_skill_harm: 2,
    clinical_note:
      "Raises readiness/engagement; indirect symptom relief via adherence and activation.",
  },
  act: {
    id: "act",
    label: "Acceptance and Commitment Therapy",
    strengths: ["cognition", "functioning", "hope", "emotion_regulation"],
    category_fit: {
      anxiety: 1.2,
      mood: 1.15,
      trauma: 1.1,
      substance: 1.1,
      personality: 1.0,
    },
    max_symptom_relief: 5,
    low_skill_harm: 3,
    clinical_note:
      "Psychological flexibility and values-based action; functioning may improve before symptoms.",
  },
  psychodynamic: {
    id: "psychodynamic",
    label: "Psychodynamic Psychotherapy",
    strengths: ["insight", "disclosure_openness", "trust", "cognition"],
    category_fit: {
      personality: 1.2,
      mood: 1.05,
      trauma: 1.1,
      anxiety: 1.0,
      psychosis: 0.75,
    },
    max_symptom_relief: 4,
    low_skill_harm: 5,
    clinical_note:
      "Insight and relational patterns; slower symptom curves; rupture-repair sensitive.",
  },
  family_psychoeducation: {
    id: "family_psychoeducation",
    label: "Family Psychoeducation",
    strengths: ["functioning", "engagement", "relapse_risk", "hope"],
    category_fit: {
      psychosis: 1.35,
      psychotic: 1.35,
      mood: 1.15,
      substance: 1.1,
      personality: 0.95,
    },
    max_symptom_relief: 4,
    low_skill_harm: 3,
    clinical_note:
      "Reduces EE/relapse risk via family system; engagement and functioning often lead.",
  },
  crisis_intervention: {
    id: "crisis_intervention",
    label: "Crisis Intervention",
    strengths: ["relapse_risk", "engagement", "trust", "hope"],
    category_fit: {
      mood: 1.1,
      trauma: 1.15,
      psychosis: 1.1,
      personality: 1.1,
      substance: 1.05,
    },
    max_symptom_relief: 3,
    low_skill_harm: 6,
    clinical_note:
      "Safety and stabilization first; may transiently raise activation; not a full course therapy.",
  },
};

export function normalizeModality(input?: string | null): TreModality {
  const s = (input ?? "supportive").toLowerCase().replace(/-/g, "_");
  if (s === "family_therapy" || s === "family") return "family_psychoeducation";
  if (s === "mi" || s === "motivational") return "motivational_interviewing";
  if (s in MODALITY_PROFILES) return s as TreModality;
  if (s.includes("cbt")) return "cbt";
  if (s.includes("dbt")) return "dbt";
  if (s.includes("act")) return "act";
  if (s.includes("psycho")) return "psychodynamic";
  if (s.includes("crisis")) return "crisis_intervention";
  if (s.includes("support")) return "supportive";
  return "supportive";
}

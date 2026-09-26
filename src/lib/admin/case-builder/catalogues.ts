/**
 * Phase 9 — educational catalogues for Guided Case Builder.
 * Sourced from Case Engine packages + curated teaching lists.
 * Not a proprietary DSM/ICD taxonomy dump.
 */

import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import type { TherapyModality } from "@/lib/case-engine/types";
import type { SymptomProfileItem } from "@/lib/types";

export type PresentationCategoryId =
  | "mood"
  | "anxiety"
  | "trauma"
  | "psychotic"
  | "personality"
  | "neurodevelopmental"
  | "substance"
  | "other";

export type TrainingPresentation = {
  id: string;
  slug: string;
  name: string;
  category: PresentationCategoryId;
  categoryLabel: string;
  dsm5_code: string | null;
  icd11_code: string | null;
  taxonomy: "vpsych-case-engine";
  taxonomyVersion: "2.0";
  min_age: number | null;
  max_age: number | null;
  sessionGoals: string[];
  symptoms: SymptomProfileItem[];
  idealApproach: string | null;
  disclosureRules: NonNullable<
    (typeof BUILTIN_DISORDERS)[number]["package"]["disclosure_rules"]
  >;
};

const CATEGORY_LABELS: Record<string, PresentationCategoryId> = {
  mood: "mood",
  anxiety: "anxiety",
  trauma: "trauma",
  psychotic: "psychotic",
  personality: "personality",
  neurodevelopmental: "neurodevelopmental",
  substance: "substance",
};

const CATEGORY_DISPLAY: Record<PresentationCategoryId, string> = {
  mood: "Depressive & Mood-Related",
  anxiety: "Anxiety Disorders",
  trauma: "Trauma- and Stressor-Related",
  psychotic: "Psychotic Disorders",
  personality: "Personality Disorders",
  neurodevelopmental: "Neurodevelopmental Disorders",
  substance: "Substance-Related",
  other: "Other training presentations",
};

function mapCategory(raw: string | null): PresentationCategoryId {
  if (!raw) return "other";
  return CATEGORY_LABELS[raw] ?? "other";
}

/** Active training presentations from the platform Case Engine catalogue. */
export function listTrainingPresentations(): TrainingPresentation[] {
  return BUILTIN_DISORDERS.filter((d) => d.is_active).map((d) => {
    const category = mapCategory(d.category);
    return {
      id: d.id,
      slug: d.slug,
      name: d.name,
      category,
      categoryLabel: CATEGORY_DISPLAY[category],
      dsm5_code: d.dsm5_code,
      icd11_code: d.icd11_code,
      taxonomy: "vpsych-case-engine",
      taxonomyVersion: "2.0",
      min_age: d.min_age,
      max_age: d.max_age,
      sessionGoals: d.package.session_goals ?? [],
      symptoms: d.package.symptom_profile ?? [],
      idealApproach: d.package.ideal_approach ?? null,
      disclosureRules: d.package.disclosure_rules ?? [],
    };
  });
}

export function findPresentationById(
  id: string,
): TrainingPresentation | undefined {
  return listTrainingPresentations().find((p) => p.id === id);
}

export function findPresentationBySlug(
  slug: string,
): TrainingPresentation | undefined {
  return listTrainingPresentations().find((p) => p.slug === slug);
}

export type GoalCategoryId =
  | "assessment"
  | "rapport"
  | "history"
  | "risk"
  | "formulation"
  | "psychoeducation"
  | "communication"
  | "intervention"
  | "planning"
  | "relapse"
  | "termination"
  | "reasoning"
  | "custom";

export type SessionGoalItem = {
  id: string;
  label: string;
  category: GoalCategoryId;
  custom?: boolean;
};

/** Curated trainee teaching goals (CI-C02) + unique package goals. */
export const CURATED_SESSION_GOALS: SessionGoalItem[] = [
  { id: "goal-rapport", label: "Establish rapport", category: "rapport" },
  {
    id: "goal-presenting",
    label: "Explore presenting complaint",
    category: "assessment",
  },
  {
    id: "goal-chronology",
    label: "Clarify symptom chronology",
    category: "history",
  },
  {
    id: "goal-impairment",
    label: "Assess functional impairment",
    category: "assessment",
  },
  {
    id: "goal-precipitating",
    label: "Explore precipitating factors",
    category: "history",
  },
  {
    id: "goal-maintaining",
    label: "Explore maintaining factors",
    category: "formulation",
  },
  { id: "goal-risk", label: "Assess risk", category: "risk" },
  {
    id: "goal-si",
    label: "Assess suicidal ideation",
    category: "risk",
  },
  {
    id: "goal-substance",
    label: "Assess substance use",
    category: "assessment",
  },
  {
    id: "goal-adherence",
    label: "Assess medication adherence",
    category: "assessment",
  },
  {
    id: "goal-stressors",
    label: "Explore psychosocial stressors",
    category: "history",
  },
  {
    id: "goal-formulation",
    label: "Develop formulation",
    category: "formulation",
  },
  {
    id: "goal-psychoeducation",
    label: "Provide psychoeducation",
    category: "psychoeducation",
  },
  {
    id: "goal-therapy-goals",
    label: "Establish therapeutic goals",
    category: "planning",
  },
  {
    id: "goal-intervention",
    label: "Practice therapeutic intervention",
    category: "intervention",
  },
  {
    id: "goal-response",
    label: "Discuss treatment response",
    category: "planning",
  },
  {
    id: "goal-relapse",
    label: "Relapse prevention",
    category: "relapse",
  },
  { id: "goal-termination", label: "Termination", category: "termination" },
  {
    id: "goal-reasoning",
    label: "Demonstrate clinical reasoning",
    category: "reasoning",
  },
  {
    id: "goal-emotion-reg",
    label: "Support emotion regulation skills",
    category: "intervention",
  },
  {
    id: "goal-communication",
    label: "Practice collaborative communication",
    category: "communication",
  },
];

export function listSessionGoals(): SessionGoalItem[] {
  const seen = new Set(CURATED_SESSION_GOALS.map((g) => g.label.toLowerCase()));
  const fromPackages: SessionGoalItem[] = [];
  for (const d of BUILTIN_DISORDERS) {
    for (const label of d.package.session_goals ?? []) {
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fromPackages.push({
        id: `pkg-${d.slug}-${fromPackages.length}`,
        label,
        category: "assessment",
      });
    }
  }
  return [...CURATED_SESSION_GOALS, ...fromPackages];
}

export type SymptomUiCategory =
  | "emotional"
  | "cognitive"
  | "behavioural"
  | "somatic"
  | "functional"
  | "risk";

const DOMAIN_TO_UI: Record<string, SymptomUiCategory> = {
  mood: "emotional",
  anxiety: "emotional",
  trauma: "emotional",
  cognition: "cognitive",
  psychotic: "cognitive",
  behavioral: "behavioural",
  social: "functional",
  sleep: "somatic",
  appetite: "somatic",
  somatic: "somatic",
};

export type LibrarySymptom = SymptomProfileItem & {
  uiCategory: SymptomUiCategory;
  sourceSlug?: string;
  custom?: boolean;
};

export function listLibrarySymptoms(): LibrarySymptom[] {
  const byId = new Map<string, LibrarySymptom>();
  for (const d of BUILTIN_DISORDERS) {
    for (const s of d.package.symptom_profile ?? []) {
      if (byId.has(s.id)) continue;
      const uiCategory =
        DOMAIN_TO_UI[s.domain ?? ""] ??
        (s.id.includes("si") || s.id.includes("risk") ? "risk" : "emotional");
      byId.set(s.id, {
        ...s,
        uiCategory,
        sourceSlug: d.slug,
      });
    }
  }
  return [...byId.values()];
}

export function mapDomainToUiCategory(
  domain: SymptomProfileItem["domain"] | undefined,
): SymptomUiCategory {
  if (!domain) return "emotional";
  return DOMAIN_TO_UI[domain] ?? "emotional";
}

export type FrameworkOption = {
  modality: TherapyModality;
  label: string;
  summary: string;
};

export const THERAPY_FRAMEWORKS: FrameworkOption[] = [
  {
    modality: "cbt",
    label: "Cognitive Behavioural Therapy (CBT)",
    summary:
      "Structured, collaborative work on thoughts, behaviours, and coping skills.",
  },
  {
    modality: "dbt",
    label: "Dialectical Behaviour Therapy (DBT)",
    summary: "Validation plus skills for emotion regulation and distress.",
  },
  {
    modality: "act",
    label: "Acceptance and Commitment Therapy (ACT)",
    summary: "Values-based action with acceptance of difficult experiences.",
  },
  {
    modality: "psychodynamic",
    label: "Psychodynamic",
    summary: "Exploration of patterns, relationships, and meaning over time.",
  },
  {
    modality: "supportive",
    label: "Supportive Psychotherapy",
    summary: "Warm, stabilizing support focused on coping and alliance.",
  },
  {
    modality: "motivational_interviewing",
    label: "Motivational Interviewing",
    summary: "Collaborative exploration of ambivalence and change talk.",
  },
  {
    modality: "family_therapy",
    label: "Family Therapy",
    summary: "Work that includes family systems and relational context.",
  },
  {
    modality: "crisis_intervention",
    label: "Crisis Intervention",
    summary: "Stabilization, safety, and short-term acute support.",
  },
  {
    modality: "exposure_therapy",
    label: "Exposure-based approaches",
    summary: "Gradual, planned exposure to feared cues with support.",
  },
];

export const COMMUNICATION_STYLES = [
  "open",
  "guarded",
  "avoidant",
  "anxious",
  "defensive",
  "irritable",
  "distrustful",
  "overinclusive",
  "minimal_responses",
  "circumstantial",
  "emotionally_labile",
] as const;

export type CommunicationStyle = (typeof COMMUNICATION_STYLES)[number];

export const THERAPEUTIC_CHALLENGES = [
  "difficulty_establishing_rapport",
  "resistance",
  "avoidance",
  "reassurance_seeking",
  "emotional_escalation",
  "silence",
  "anger",
  "dependency",
  "intellectualization",
  "limited_insight",
] as const;

export type TherapeuticChallenge = (typeof THERAPEUTIC_CHALLENGES)[number];

export const GOAL_CATEGORY_ORDER: GoalCategoryId[] = [
  "rapport",
  "assessment",
  "history",
  "risk",
  "formulation",
  "psychoeducation",
  "communication",
  "intervention",
  "planning",
  "relapse",
  "termination",
  "reasoning",
  "custom",
];

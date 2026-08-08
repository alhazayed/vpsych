import type {
  BehaviorResponse,
  BehaviorTrigger,
  InteractionStyle,
  TrainingCompetency,
  VirtualPatientDraft,
} from "@/lib/admin/virtual-patients";
import {
  BEHAVIOR_RESPONSE_LABELS,
  BEHAVIOR_TRIGGER_LABELS,
  COMPETENCY_LABELS,
} from "@/lib/admin/virtual-patients";

export const INTERACTION_STYLE_LABELS: Record<InteractionStyle, string> = {
  cooperative: "Cooperative",
  guarded: "Guarded",
  avoidant: "Avoidant",
  irritable: "Irritable",
  emotional: "Emotional",
  withdrawn: "Withdrawn",
  circumstantial: "Circumstantial",
};

export const INTERACTION_STYLES = Object.keys(
  INTERACTION_STYLE_LABELS,
) as InteractionStyle[];

export const TRAIT_LABELS: Record<
  keyof VirtualPatientDraft["traits"],
  string
> = {
  trust: "Trust",
  anxiety: "Anxiety",
  defensiveness: "Defensiveness",
  emotionalExpressiveness: "Emotional expressiveness",
  insight: "Insight",
  cooperation: "Cooperation",
};

export const DIFFICULTY_LABELS: Record<
  VirtualPatientDraft["difficulty"],
  string
> = {
  introductory: "Introductory",
  standard: "Standard",
  advanced: "Advanced",
  expert: "Expert",
};

export const SEVERITY_LABELS: Record<VirtualPatientDraft["severity"], string> =
  {
    subclinical: "Subclinical",
    mild: "Mild",
    moderate: "Moderate",
    severe: "Severe",
  };

export const GENDER_LABELS: Record<VirtualPatientDraft["gender"], string> = {
  female: "Female",
  male: "Male",
  "non-binary": "Non-binary",
  unspecified: "Unspecified",
};

export const SPEAKING_SPEED_LABELS: Record<
  VirtualPatientDraft["speakingSpeed"],
  string
> = {
  slow: "Slow",
  normal: "Normal",
  fast: "Fast",
};

export const EMOTIONAL_BASELINE_LABELS: Record<
  VirtualPatientDraft["emotionalBaseline"],
  string
> = {
  calm: "Calm",
  anxious: "Anxious",
  low: "Low energy",
  irritable: "Irritable",
  flat: "Flat",
};

export const PORTRAIT_OPTIONS = [
  { value: "/avatars/maya.svg", label: "Maya" },
  { value: "/avatars/jordan.svg", label: "Jordan" },
] as const;

export const COMPETENCY_KEYS = Object.keys(
  COMPETENCY_LABELS,
) as TrainingCompetency[];

export const BEHAVIOR_TRIGGERS = Object.keys(
  BEHAVIOR_TRIGGER_LABELS,
) as BehaviorTrigger[];

export const BEHAVIOR_RESPONSES = Object.keys(
  BEHAVIOR_RESPONSE_LABELS,
) as BehaviorResponse[];

export { BEHAVIOR_RESPONSE_LABELS, BEHAVIOR_TRIGGER_LABELS, COMPETENCY_LABELS };

export function titleCaseToken(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split(/[_-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

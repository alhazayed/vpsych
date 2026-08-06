import type {
  BlindCondition,
  CqiCategory,
  CqiSeverity,
  EducationalOpportunityType,
  FeatureRequestTheme,
  Likert1to5,
} from "./types";

export function parseLikert(value: unknown): Likert1to5 | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

export function parseOptionalLikert(value: unknown): Likert1to5 | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return parseLikert(value) ?? undefined;
}

const SEVERITIES: CqiSeverity[] = ["critical", "high", "medium", "wishlist"];
const CATEGORIES: CqiCategory[] = [
  "clinical_realism",
  "conversation",
  "voice_tts",
  "assessment",
  "safety",
  "ui_ux",
  "bilingual",
  "other",
];
const EOI_TYPES: EducationalOpportunityType[] = [
  "missed_teaching_moment",
  "strong_teaching_moment",
  "curriculum_gap",
  "competency_focus",
  "supervision_use_case",
  "other",
];
const THEMES: FeatureRequestTheme[] = [
  "simulation",
  "assessment",
  "voice",
  "curriculum",
  "admin",
  "bilingual",
  "general",
];
const BLIND: BlindCondition[] = ["ai_patient", "human_sp", "unknown"];

export function parseSeverity(v: unknown): CqiSeverity | null {
  return typeof v === "string" && (SEVERITIES as string[]).includes(v)
    ? (v as CqiSeverity)
    : null;
}

export function parseCategory(v: unknown): CqiCategory | null {
  return typeof v === "string" && (CATEGORIES as string[]).includes(v)
    ? (v as CqiCategory)
    : null;
}

export function parseEoiType(v: unknown): EducationalOpportunityType | null {
  return typeof v === "string" && (EOI_TYPES as string[]).includes(v)
    ? (v as EducationalOpportunityType)
    : null;
}

export function parseTheme(v: unknown): FeatureRequestTheme | null {
  return typeof v === "string" && (THEMES as string[]).includes(v)
    ? (v as FeatureRequestTheme)
    : null;
}

export function parseBlindCondition(v: unknown): BlindCondition | null {
  return typeof v === "string" && (BLIND as string[]).includes(v)
    ? (v as BlindCondition)
    : null;
}

export function parseBoundedText(
  v: unknown,
  min: number,
  max: number,
): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < min || t.length > max) return null;
  return t;
}

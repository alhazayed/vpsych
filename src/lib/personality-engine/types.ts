/**
 * Human Personality Engine — typed contracts (v1).
 *
 * Exists independently of GPT: profiles are authored, validated, persisted, and
 * injected into every patient turn. Diagnosis lives on the Case Engine;
 * personality lives here. Two patients with the same disorder must still feel
 * like different people.
 */

/** Likert 1–5 trait scale used for Big Five, resilience, and trust. */
export type TraitScale = 1 | 2 | 3 | 4 | 5;

export type AttachmentStyle =
  | "secure"
  | "anxious_preoccupied"
  | "dismissive_avoidant"
  | "fearful_avoidant"
  | "disorganized";

export type CopingStyle =
  | "problem_focused"
  | "emotion_focused"
  | "avoidant"
  | "support_seeking"
  | "intellectualizing"
  | "withdrawal"
  | "reassurance_seeking"
  | "somatic"
  | "mixed";

export type HumorStyle =
  | "none"
  | "dry"
  | "self_deprecating"
  | "warm"
  | "deflective"
  | "dark"
  | "rare_soft";

export type EmotionalRegulationStyle =
  | "expressive"
  | "suppressive"
  | "volatile"
  | "intellectualized"
  | "somatic_channel"
  | "delayed_flood"
  | "mixed";

export type IntelligenceProfile = {
  /** Qualitative band — not an IQ claim. */
  band: "average" | "above_average" | "high" | "very_high";
  strengths: string[];
  style: string;
};

export type VocabularyProfile = {
  register: "concrete" | "everyday" | "educated" | "technical" | "mixed";
  markers: string[];
  avoids: string[];
};

/**
 * How this person remembers and relates to the therapist — within and across
 * sessions. Conversation history supplies facts; this policy supplies style.
 */
export type TherapistMemoryPolicy = {
  remembers_name: boolean;
  remembers_prior_sessions: boolean;
  /** Sensitivity to therapist warmth / engagement (1 = numb, 5 = exquisite). */
  alliance_sensitivity: TraitScale;
  rupture_style: string;
  notes: string;
};

/**
 * Canonical human personality profile for one avatar locale.
 * Locale-neutral Big Five + interpersonal traits; culture/religion/education/
 * occupation/speech may differ by locale (natively authored, never translated).
 */
export type HumanPersonalityProfile = {
  version: 1;
  /** Avatar slug this profile was authored for (stability check). */
  avatar_slug?: string;
  locale: string;

  temperament: string;
  attachment_style: AttachmentStyle;
  /** Free-text nuance on attachment (overlays, clinician vs intimate). */
  attachment_notes: string;
  intelligence: IntelligenceProfile;
  education: string;
  occupation: string;
  culture: string;
  religion: string;

  resilience: TraitScale;
  openness: TraitScale;
  agreeableness: TraitScale;
  conscientiousness: TraitScale;
  neuroticism: TraitScale;

  coping_style: CopingStyle;
  coping_notes: string;
  humor: HumorStyle;
  humor_notes: string;
  trust_level: TraitScale;
  trust_notes: string;
  emotional_regulation: EmotionalRegulationStyle;
  emotional_regulation_notes: string;

  speech_style: string;
  vocabulary: VocabularyProfile;
  preferred_topics: string[];
  avoidant_topics: string[];

  memory_of_therapist: TherapistMemoryPolicy;
  treatment_expectations: string;

  /** Optional clinical-author notes (not always injected verbatim). */
  author_notes?: string;
};

/** Map of locale → profile stored on `avatars.human_personality`. */
export type HumanPersonalityMap = Partial<
  Record<string, HumanPersonalityProfile>
>;

export type PersonalityValidationIssue = {
  code: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
};

export type PersonalityValidationResult =
  | { ok: true; profile: HumanPersonalityProfile }
  | { ok: false; issues: PersonalityValidationIssue[] };

export const ATTACHMENT_STYLES: readonly AttachmentStyle[] = [
  "secure",
  "anxious_preoccupied",
  "dismissive_avoidant",
  "fearful_avoidant",
  "disorganized",
] as const;

export const COPING_STYLES: readonly CopingStyle[] = [
  "problem_focused",
  "emotion_focused",
  "avoidant",
  "support_seeking",
  "intellectualizing",
  "withdrawal",
  "reassurance_seeking",
  "somatic",
  "mixed",
] as const;

export const HUMOR_STYLES: readonly HumorStyle[] = [
  "none",
  "dry",
  "self_deprecating",
  "warm",
  "deflective",
  "dark",
  "rare_soft",
] as const;

export const EMOTIONAL_REGULATION_STYLES: readonly EmotionalRegulationStyle[] =
  [
    "expressive",
    "suppressive",
    "volatile",
    "intellectualized",
    "somatic_channel",
    "delayed_flood",
    "mixed",
  ] as const;

export const TRAIT_SCALE_MIN = 1;
export const TRAIT_SCALE_MAX = 5;

/**
 * Mission 6 — Living Environment Engine types.
 *
 * The patient exists inside a living world. Every CaseInstance mints an
 * immutable LivingWorld (home, family, work, friends, finances, medical
 * history, daily routine, social media, education). Facts stay consistent
 * forever for that case — never regenerated mid-session.
 */

export const LIVING_ENVIRONMENT_VERSION = "1.0.0" as const;

export type HousingTenure = "rent" | "own" | "family_home" | "other";

export type WorkStatus =
  | "employed"
  | "self_employed"
  | "unemployed"
  | "student"
  | "leave"
  | "caregiver";

export type FriendCloseness = "close" | "casual" | "distant";

export type LivingWorldHome = {
  housing_type: string;
  /** Neighborhood / area — never a precise street address. */
  address_area: string;
  city: string;
  country: string;
  household_members: string[];
  description: string;
  tenure: HousingTenure;
  monthly_housing_cost: string;
};

export type LivingWorldFamilyMember = {
  relation: string;
  name: string;
  age: number;
  living_nearby: boolean;
  relationship_quality: string;
  notes: string;
};

export type LivingWorldFamily = {
  members: LivingWorldFamilyMember[];
  origin_story: string;
  contact_frequency: string;
};

export type LivingWorldWork = {
  status: WorkStatus;
  title: string;
  employer_or_context: string;
  schedule: string;
  tenure: string;
  stressors: string[];
  satisfaction: string;
};

export type LivingWorldFriend = {
  name: string;
  how_met: string;
  closeness: FriendCloseness;
  contact_pattern: string;
  notes: string;
};

export type LivingWorldFriends = {
  friends: LivingWorldFriend[];
  social_energy: string;
  recent_withdrawal: string;
};

export type LivingWorldFinances = {
  income_band: string;
  currency: string;
  problems: string[];
  debt_or_bills: string;
  savings_status: string;
  primary_worry: string;
};

export type LivingWorldMedicalCondition = {
  name: string;
  status: string;
  notes: string;
};

export type LivingWorldMedication = {
  name: string;
  purpose: string;
  adherence: string;
};

export type LivingWorldHospitalization = {
  reason: string;
  when: string;
  age_at_event: number;
  notes: string;
};

export type LivingWorldMedicalHistory = {
  conditions: LivingWorldMedicalCondition[];
  medications: LivingWorldMedication[];
  allergies: string[];
  hospitalizations: LivingWorldHospitalization[];
  primary_care: string;
};

export type LivingWorldRoutineSlot = {
  time: string;
  activity: string;
};

export type LivingWorldDailyRoutine = {
  weekday: LivingWorldRoutineSlot[];
  weekend_difference: string;
  sleep_schedule: string;
  wake_time: string;
  bed_time: string;
  meals: string;
  exercise_or_movement: string;
};

export type LivingWorldSocialPlatform = {
  name: string;
  usage: string;
  publicness: string;
};

export type LivingWorldSocialMedia = {
  platforms: LivingWorldSocialPlatform[];
  posting_style: string;
  doomscroll_or_avoidance: string;
  online_vs_offline: string;
};

export type LivingWorldEducation = {
  highest_level: string;
  field: string;
  institution_type: string;
  graduation_year_approx: number | null;
  years_completed: number;
  ongoing: boolean;
  notes: string;
};

/** Immutable living world for one CaseInstance. */
export type LivingWorld = {
  version: typeof LIVING_ENVIRONMENT_VERSION;
  world_id: string;
  case_instance_id?: string;
  persona_slug?: string;
  locale: string;
  seed: string;
  generated_at: string;
  /** Patient age at mint — anchors education / family ages. */
  patient_age: number;
  patient_gender?: string;
  home: LivingWorldHome;
  family: LivingWorldFamily;
  work: LivingWorldWork;
  friends: LivingWorldFriends;
  financial_problems: LivingWorldFinances;
  medical_history: LivingWorldMedicalHistory;
  daily_routine: LivingWorldDailyRoutine;
  social_media: LivingWorldSocialMedia;
  education: LivingWorldEducation;
  /** Canonical facts the patient never contradicts. */
  consistency_anchors: string[];
};

export type LivingWorldDomain =
  | "home"
  | "family"
  | "work"
  | "friends"
  | "financial_problems"
  | "medical_history"
  | "daily_routine"
  | "social_media"
  | "education";

export const LIVING_WORLD_DOMAINS: LivingWorldDomain[] = [
  "home",
  "family",
  "work",
  "friends",
  "financial_problems",
  "medical_history",
  "daily_routine",
  "social_media",
  "education",
];

export type LivingConsistencyIssue = {
  code: string;
  message: string;
  domains?: LivingWorldDomain[];
  path?: string;
};

export type LivingConsistencyResult =
  | { ok: true }
  | { ok: false; issues: LivingConsistencyIssue[] };

/** Optional life-context hints from Case Engine randomized_context. */
export type LivingWorldContextHints = {
  financial_situation?: string;
  relationship_detail?: string;
  occupation_variant?: string;
  recent_stressor?: string;
  minor_life_event?: string;
};

export type LivingWorldGenerationInput = {
  seed: string | number;
  locale: string;
  age: number;
  gender?: string;
  personaSlug?: string;
  displayName?: string;
  occupationBaseline?: string;
  educationBaseline?: string;
  familyBaseline?: string;
  cityHint?: string;
  countryHint?: string;
  randomized?: LivingWorldContextHints;
  /** When regenerating after a failed consistency pass. */
  attempt?: number;
};

export type LivingWorldGenerationResult =
  | { ok: true; world: LivingWorld }
  | { ok: false; issues: LivingConsistencyIssue[] };

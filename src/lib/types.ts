export type UserRole = "therapist" | "admin";
export type SessionStatus = "active" | "completed" | "expired";
export type MessageRole = "user" | "assistant" | "system";

/** UI / session language. Mirrors the profiles.preferred_language CHECK. */
export type PreferredLanguage = "en" | "ar";

/** BCP-47 language[-region] tag used for avatar personalities. */
export type AvatarLocale = "en-US" | "ar-JO" | (string & {});

export type Profile = {
  id: string;
  display_name: string;
  role: UserRole;
  preferred_language?: PreferredLanguage | null;
  created_at: string;
  updated_at: string;
};

export type RubricItem = {
  id: string;
  label: string;
  weight: number;
  max: number;
};

export type SymptomProfileItem = {
  id: string;
  description: string;
  domain?:
    | "mood"
    | "anxiety"
    | "sleep"
    | "appetite"
    | "cognition"
    | "somatic"
    | "social"
    | "behavioral"
    | "psychotic"
    | "trauma";
  salience?: "presenting" | "elicited" | "hidden";
};

export type DisclosureRule = {
  topic: string;
  condition:
    | "volunteered"
    | "on_direct_question"
    | "on_empathic_rapport"
    | "on_safety_assessment"
    | "never";
  notes?: string;
};

export type RiskProfile = {
  suicidal_ideation: "none" | "passive" | "active_no_plan" | "active_with_plan";
  self_harm?: boolean;
  harm_to_others?: boolean;
  substance_use?: boolean;
  escalation_rules?: string;
};

/** Module 1 — language-neutral clinical presentation. */
export type ClinicalCore = {
  disorder: string;
  dsm5_code?: string;
  icd11_code?: string;
  age: number;
  gender: "female" | "male" | "non-binary" | "unspecified";
  severity?: "subclinical" | "mild" | "moderate" | "severe";
  onset_duration?: string;
  symptom_profile: SymptomProfileItem[];
  disclosure_rules: DisclosureRule[];
  session_goals: string[];
  ideal_approach: string;
  risk_profile: RiskProfile;
};

export type PersonalityIdentity = {
  display_name: string;
  given_name?: string;
  family_name?: string;
  city: string;
  region?: string;
  country: string;
  occupation: string;
  education?: string;
  living_situation?: string;
  family_context?: string;
  socioeconomic_context?: string;
  portrait_url?: string;
};

export type PersonalitySpeech = {
  register: "formal" | "neutral" | "colloquial" | "mixed";
  formality?: string;
  pace?: "slow" | "measured" | "fast" | "variable";
  dialect_markers?: string[];
  filler_words?: string[];
  verbal_tics?: string[];
  code_switching?: string;
  sample_utterances: string[];
  turn_length?: string;
};

export type CulturalContext = {
  stigma_framing: string;
  help_seeking_attitude: string;
  family_involvement?: string;
  authority_orientation?: string;
  disclosure_norms?: string;
  faith_or_meaning_framing?: string;
  taboo_topics?: string[];
};

export type LanguageModule = {
  directive: string;
  per_turn_reinforcement?: string;
  on_therapist_code_switch?: string;
  script?: string;
  forbidden_scripts?: string[];
  fallback_replies?: string[];
};

export type CrisisResource = {
  name: string;
  contact: string;
  hours?: string;
  region?: string;
};

export type SafetyModule = {
  crisis_resources: CrisisResource[];
  risk_disclosure_style: string;
  boundary_rules: string[];
  escalation_language?: string;
};

export type PersonalityVoice = {
  provider?: string;
  voice_id?: string;
  /** Optional FK into voice_profiles (registry). */
  voice_profile_id?: string;
  stt_lang: string;
  tts_lang: string;
  rate?: number;
  pitch?: number;
};

/** Row shape for `public.voice_profiles` (ElevenLabs voice registry). */
export type VoiceProfile = {
  id: string;
  provider: string;
  voice_name: string;
  voice_id: string;
  language: PreferredLanguage | (string & {});
  dialect: string | null;
  gender: string | null;
  is_active: boolean;
  created_at: string;
};

/** Module 2 — natively authored personality for one locale. */
export type AvatarPersonality = {
  locale: AvatarLocale;
  language: string;
  language_native_name?: string;
  dialect?: string;
  direction: "ltr" | "rtl";
  authored_natively: true;
  never_translate: true;
  parity_note?: string;
  identity: PersonalityIdentity;
  persona_prompt: string;
  speech: PersonalitySpeech;
  idioms_of_distress?: string[];
  cultural_context: CulturalContext;
  clinical_localization?: { symptom_id: string; expression: string }[];
  language_module: LanguageModule;
  safety_module: SafetyModule;
  voice: PersonalityVoice;
  rubric_labels?: Record<string, string>;
  clinical_review?: {
    status: "draft" | "in_review" | "approved";
    reviewer?: string;
    reviewed_at?: string;
    notes?: string;
  };
  is_active?: boolean;
};

/**
 * Row shape for `public.avatars`.
 * schema_version 1: flat columns only.
 * schema_version 2: clinical_core + personalities; flat columns kept in sync for v1 consumers.
 */
export type Avatar = {
  id: string;
  name: string;
  disorder: string;
  age: number | null;
  gender: string | null;
  portrait_url: string | null;
  persona_prompt: string;
  ideal_guidelines: {
    session_goals?: string[];
    ideal_approach?: string;
  };
  rubric: RubricItem[];
  language?: string | null;
  dialect?: string | null;
  /** BCP-47 locales with an authored personality (synced from personalities) */
  available_locales?: string[] | null;
  /** FK to voice_profiles — preferred TTS resolution path */
  voice_profile_id?: string | null;
  /** Joined voice_profiles row when selected with embed */
  voice_profile?: VoiceProfile | null;
  /** ElevenLabs voice id for English / primary TTS (legacy / cache) */
  voice_id?: string | null;
  /** ElevenLabs voice id for Arabic TTS (legacy / cache) */
  voice_id_ar?: string | null;
  schema_version?: number;
  slug?: string | null;
  default_locale?: string | null;
  clinical_core?: ClinicalCore | null;
  personalities?: Partial<Record<string, AvatarPersonality>> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Runtime projection used by AI + voice session (locale-resolved). */
export type ResolvedAvatar = {
  id: string;
  schema_version: number;
  locale: string;
  language: string;
  direction: "ltr" | "rtl";
  name: string;
  disorder: string;
  age: number | null;
  gender: string | null;
  portrait_url: string | null;
  persona_prompt: string;
  system_prompt: string;
  ideal_guidelines: {
    session_goals?: string[];
    ideal_approach?: string;
  };
  rubric: RubricItem[];
  dialect: string | null;
  /** Assigned registry profile id when present */
  voice_profile_id?: string | null;
  /** Active joined profile used for synthesis (null if inactive / missing) */
  voice_profile?: VoiceProfile | null;
  voice_id: string | null;
  voice_id_ar?: string | null;
  stt_lang: string;
  tts_lang: string;
  tts_rate?: number;
  fallback_replies: string[];
  per_turn_reinforcement?: string;
  personality?: AvatarPersonality;
  clinical_core?: ClinicalCore | null;
};

export type TherapySession = {
  id: string;
  therapist_id: string;
  avatar_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  max_duration_sec: number;
  language?: string | null;
  created_at: string;
  avatars?: Avatar;
  profiles?: Profile;
};

export type SessionMessage = {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

export type ScoreEntry = {
  id: string;
  label: string;
  score: number;
  max: number;
  weight: number;
  feedback: string;
};

export type SessionReport = {
  id: string;
  session_id: string;
  scores: {
    overall: number;
    items: ScoreEntry[];
  };
  narrative: string;
  excerpts: string[];
  language?: string | null;
  created_at: string;
  sessions?: TherapySession;
};

export const MAX_SESSION_SECONDS = 40 * 60;
export const DEFAULT_AVATAR_LOCALE = "en-US";

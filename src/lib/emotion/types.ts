/**
 * Emotion Engine (Mission 2) — continuous patient affect contracts.
 *
 * Every patient possesses an evolving emotional state. Therapist interventions
 * modify variables; trust and rapport gate future responsiveness. Expression
 * layers (voice, face, word choice, hesitation, body language) are derived
 * deterministically from state — the LLM may express, never invent, emotion.
 */

export const EMOTION_ENGINE_VERSION = "1.0.0";

/** Continuous affect dimensions — all clamped to 0–100. */
export type EmotionalVariables = {
  /** Slow-moving temperament for this case (disorder prior). */
  baseline_mood: number;
  /** Moment-to-moment mood (decays toward baseline). */
  current_mood: number;
  stress: number;
  fear: number;
  anger: number;
  hope: number;
  /** Sticky; changes slowly; gates future intervention gains. */
  trust: number;
  /** Sticky alliance warmth; rises with sustained empathic work. */
  rapport: number;
  fatigue: number;
  /** Readiness to engage / change. */
  motivation: number;
};

export type EmotionVariableKey = keyof EmotionalVariables;

export const EMOTION_VARIABLE_KEYS: EmotionVariableKey[] = [
  "baseline_mood",
  "current_mood",
  "stress",
  "fear",
  "anger",
  "hope",
  "trust",
  "rapport",
  "fatigue",
  "motivation",
];

/**
 * Therapist intervention classes that modify emotion.
 * Classifiers may emit one primary + optional secondary moves.
 */
export type TherapistIntervention =
  | "validation"
  | "empathy"
  | "reflection"
  | "open_question"
  | "closed_question"
  | "support"
  | "psychoeducation"
  | "confrontation"
  | "advice"
  | "hostility"
  | "invalidation"
  | "rupture_repair"
  | "safety_check"
  | "silence"
  | "homework_review"
  | "other";

export type EmotionMode =
  | "engaged"
  | "guarded"
  | "withdrawn"
  | "activated"
  | "collapsed"
  | "warming";

export type EmotionTransition = {
  turn: number;
  at: string;
  intervention: TherapistIntervention;
  secondary?: TherapistIntervention[];
  deltas: Partial<EmotionalVariables>;
  mode_before: EmotionMode;
  mode_after: EmotionMode;
  notes: string[];
};

/** Full emotion machine state persisted per case instance. */
export type EmotionState = {
  emotion_engine_version: string;
  case_instance_id: string | null;
  session_id: string | null;
  disorder_slug: string | null;
  variables: EmotionalVariables;
  mode: EmotionMode;
  turn: number;
  /** Consecutive low-trust / hostile turns; drives withdrawal stickiness. */
  withdrawal_streak: number;
  /** Consecutive empathic / validating turns; drives warming. */
  alliance_streak: number;
  history: EmotionTransition[];
  created_at: string;
  updated_at: string;
};

/** Deterministic expression packet for voice / avatar / prompt layers. */
export type EmotionExpression = {
  mode: EmotionMode;
  /** Discrete affect label for facial / TTS emotion tags. */
  facial_affect:
    | "neutral"
    | "anxious"
    | "depressed"
    | "irritable"
    | "tearful"
    | "guarded"
    | "hopeful"
    | "flat"
    | "agitated"
    | "warm";
  voice: {
    rate: number;
    volume: number;
    pitch: number;
    pause_scale: number;
    stability: number;
    similarity_boost: number;
    style: number;
  };
  /** Thinking / start latency before first token (ms). */
  hesitation_ms: number;
  /** Prompt directives for word choice — never free invention. */
  word_choice: string[];
  /** Nonverbal / body-language cue ids (PME / therapy-room compatible). */
  body_language: string[];
  /** Animation hook ids for 3D / rig systems. */
  animation_hooks: string[];
  /** Trust-gated disclosure openness 0–100. */
  openness: number;
  summary: string;
};

export type EmotionTickInput = {
  state: EmotionState;
  /** Explicit intervention; if omitted, classified from therapistMessage. */
  intervention?: TherapistIntervention;
  secondary?: TherapistIntervention[];
  therapistMessage?: string;
  /** Optional disorder slug for baseline / inertia priors. */
  disorderSlug?: string | null;
  /** Elapsed session seconds — fatigue creep. */
  elapsedSeconds?: number;
  now?: string;
};

export type EmotionTickResult = {
  state: EmotionState;
  expression: EmotionExpression;
  applied: {
    intervention: TherapistIntervention;
    secondary: TherapistIntervention[];
    deltas: Partial<EmotionalVariables>;
  };
};

export type EmotionInitInput = {
  disorderSlug?: string | null;
  caseInstanceId?: string | null;
  sessionId?: string | null;
  /** Optional overrides on top of disorder baseline. */
  overrides?: Partial<EmotionalVariables>;
  now?: string;
};

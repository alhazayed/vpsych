/**
 * Mission 10 — Humanization Engine contracts.
 *
 * Goal: make trainees forget they are talking to AI, while remaining
 * clinically accurate for the session's diagnosis and risk profile.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { ClinicalCore, SessionMessage } from "@/lib/types";

export const HUMANIZATION_SCHEMA_VERSION = 1;

/** Atomic humanization behaviours the patient may enact this turn. */
export type HumanizationBehaviorId =
  | "thinking_pause"
  | "hesitation"
  | "false_start"
  | "self_correction"
  | "laughter"
  | "crying"
  | "breathing"
  | "filler_words"
  | "changing_mind"
  | "asking_therapist_questions"
  | "remembering_previous_sessions"
  | "emotionally_reacting"
  | "small_talk"
  | "humor"
  | "fatigue"
  | "silence"
  | "interruptions"
  | "uncertainty"
  | "look_away"
  | "forget"
  | "rephrase"
  | "distracted"
  | "be_emotional";

export type AffectPrimary =
  | "neutral"
  | "sad"
  | "anxious"
  | "ashamed"
  | "irritable"
  | "relieved"
  | "numb"
  | "hopeful"
  | "tearful"
  | "fatigued";

export type TherapistMove =
  | "reflection"
  | "validation"
  | "closed_question"
  | "open_question"
  | "advice"
  | "safety_check"
  | "invalidation"
  | "rupture_repair"
  | "rapport"
  | "silence"
  | "other";

export type HumanizationBehaviorDef = {
  id: HumanizationBehaviorId;
  /** Prompt directive — enact, never announce the label. */
  directive_en: string;
  directive_ar: string;
  /** Relative weight for selection (higher = more common when eligible). */
  base_weight: number;
  /** Categories this behaviour fits clinically. */
  preferred_categories: string[];
  /** Soft ceiling — max times per session before down-weighting. */
  max_per_session: number;
};

/** Emotion Engine output for one turn. */
export type EmotionEngineOutput = {
  primary: AffectPrimary;
  intensity: number; // 1–10
  congruence: "congruent" | "guarded" | "incongruent";
  directives: string[];
  triggers_fired: string[];
};

/** Behavior Engine output for one turn. */
export type BehaviorEngineOutput = {
  cooperation: number; // 0–100
  resistance_mode: string;
  speech_pace: "slow" | "measured" | "fast" | "variable" | "pressured";
  speech_energy: "low" | "moderate" | "high" | "labile";
  defense_active: string | null;
  directives: string[];
  category: string;
};

/** Memory Engine output for one turn. */
export type MemoryEngineOutput = {
  recalled_facts: string[];
  prior_session_cues: string[];
  topics_touched: string[];
  imperfect_recall_ok: boolean;
  directives: string[];
};

/** Voice Engine output — TTS / playback hints. */
export type VoiceEngineOutput = {
  stability: number;
  similarity_boost: number;
  style: number;
  pause_before_ms: number;
  speech_rate: number;
  breathiness_hint: number;
  tremor_hint: number;
  directives: string[];
};

export type ClinicalGateResult = {
  allowed: HumanizationBehaviorId[];
  blocked: Array<{ id: HumanizationBehaviorId; reason: string }>;
};

export type HumanizationTurnPlan = {
  schema_version: number;
  enabled: true;
  therapist_move: TherapistMove;
  behaviors: HumanizationBehaviorId[];
  prompt_cue: string;
  per_turn_cue: string;
  nonverbal_cues: string[];
  emotion: EmotionEngineOutput;
  behavior: BehaviorEngineOutput;
  memory: MemoryEngineOutput;
  voice: VoiceEngineOutput;
  clinical_blocked: ClinicalGateResult["blocked"];
};

export type HumanizationTurnInput = {
  sessionId: string;
  caseSnapshot: CaseInstanceSnapshot | null;
  clinicalCore?: ClinicalCore | null;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
  sessionLanguage: string;
  elapsedSeconds: number;
  maxDurationSec: number;
  /**
   * @deprecated Humanization must not scrape case_memory for facts.
   * Prefer `hasPriorSessionMemory` from Patient Memory retrieval.
   */
  caseMemory?: Record<string, unknown> | null;
  /** True when Patient Memory retrieved ≥1 durable fact this turn. */
  hasPriorSessionMemory?: boolean;
  /**
   * Mission 2 Emotion Engine presentation packet (optional).
   * When present, humanization maps delivery colour from it — never invents affect.
   */
  externalEmotion?: {
    mode?: string | null;
    facial_affect?: string | null;
    openness?: number | null;
    hesitation_ms?: number | null;
    variables?: {
      current_mood?: number;
      trust?: number;
      anger?: number;
      hope?: number;
      fatigue?: number;
      fear?: number;
    } | null;
  } | null;
  /** Deterministic seed override (tests). */
  seed?: string | number;
};

export type HumanizationClientHints = {
  enabled: true;
  behaviors: HumanizationBehaviorId[];
  nonverbal: string[];
  voiceHints: {
    pause_before_ms: number;
    speech_rate: number;
    stability: number;
    style: number;
    speech_pace: BehaviorEngineOutput["speech_pace"];
    speech_energy: BehaviorEngineOutput["speech_energy"];
  };
  affect: {
    primary: AffectPrimary;
    intensity: number;
  };
};

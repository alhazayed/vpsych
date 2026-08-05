/**
 * Human Conversation Engine (HCE) — TypeScript contracts.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { ClinicalCore, ResolvedAvatar, SessionMessage } from "@/lib/types";

export const HCE_MEMORY_SCHEMA_VERSION = 1;

export type AffectPrimary =
  | "neutral"
  | "sad"
  | "anxious"
  | "ashamed"
  | "irritable"
  | "relieved"
  | "numb"
  | "hopeful";

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

export type ReasoningMode = "fast" | "deep";

export type EpisodicMemory = {
  id: string;
  fact: string;
  turn: number;
  topics: string[];
};

export type HceMemoryState = {
  schema_version: number;
  episodic: EpisodicMemory[];
  relationship: {
    alliance: number;
    last_tone: "warm" | "neutral" | "strained";
  };
  disclosed: string[];
  disclosure_layer: number;
  safety: {
    si_assessed: boolean;
    level: "none" | "passive" | "active";
  };
  emotion: {
    primary: AffectPrimary;
    intensity: number;
    congruence: "congruent" | "guarded" | "incongruent";
  };
  environment: {
    fatigue: number;
    phase: "opening" | "middle" | "closing" | "overtime";
  };
  behavior: {
    cooperation: number;
    active_defense: string | null;
    speech_pace: "slow" | "measured" | "fast" | "variable";
    turn_length_target: number;
  };
  longitudinal?: Record<string, unknown>;
};

export type CaseMemoryRow = {
  case_instance_id: string;
  memory: Record<string, unknown>;
  longitudinal_group_id?: string | null;
};

export type TurnBrief = {
  turn_goal: string;
  alliance_target: string;
  clinical_directives: string[];
  emotion_directives: string[];
  behavior_directives: string[];
  voice_directives: string[];
  constraints: string[];
  reasoning_mode: ReasoningMode;
  therapist_move: TherapistMove;
};

export type MemoryEngineOutput = {
  recalled_facts: string[];
  relationship_summary: string;
  topics_touched: string[];
  forbidden_repetition: string[];
};

export type EmotionEngineOutput = {
  primary_affect: AffectPrimary;
  intensity: number;
  congruence: string;
  triggers_fired: string[];
  directives: string[];
};

export type ClinicalEngineOutput = {
  may_disclose: string[];
  must_withhold: string[];
  risk_delta: string;
  symptom_expression: string;
  disclosure_layer: number;
};

export type EnvironmentEngineOutput = {
  fatigue: number;
  setting: string;
  ambient_stressors: string[];
  time_pressure: boolean;
  phase: HceMemoryState["environment"]["phase"];
};

export type BehaviorEngineOutput = {
  cooperation: number;
  resistance_mode: string;
  defense_active: string | null;
  speech_pace: HceMemoryState["behavior"]["speech_pace"];
  turn_length_target: number;
  directives: string[];
};

export type VoiceEngineOutput = {
  stability: number;
  similarity_boost: number;
  style: number;
  pause_before_ms: number;
  directives: string[];
};

export type EngineSnapshots = {
  memory: MemoryEngineOutput;
  emotion: EmotionEngineOutput;
  clinical: ClinicalEngineOutput;
  environment: EnvironmentEngineOutput;
  behavior: BehaviorEngineOutput;
  voice: VoiceEngineOutput;
};

export type GptTurnOutput = {
  patient_utterance: string;
  internal_note?: string;
  memory_writes?: Array<{ key: string; value: string; ttl?: number }>;
  emotion_delta?: { primary?: AffectPrimary; intensity_delta?: number };
  clinical_events?: Array<{ type: string; topic?: string }>;
  voice_markup?: { breaks?: number[]; emphasis?: string[] };
};

export type HceTurnResult = {
  text: string;
  aiSource: "gpt" | "gateway" | "persona_fallback";
  model?: string;
  errorKind?: string;
  reasoningMode: ReasoningMode;
  voiceHints: VoiceEngineOutput & {
    voice_markup?: GptTurnOutput["voice_markup"];
  };
  alliance: number;
  hceEnabled: true;
};

export type HceTurnInput = {
  sessionId: string;
  avatar: ResolvedAvatar;
  caseSnapshot: CaseInstanceSnapshot;
  caseInstanceId: string;
  history: Pick<SessionMessage, "role" | "content">[];
  userMessage: string;
  sessionLanguage: string;
  elapsedSeconds: number;
  maxDurationSec: number;
  memoryRow: CaseMemoryRow | null;
};

export type ClinicalCoreContext = ClinicalCore;

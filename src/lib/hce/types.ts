/**
 * Human Conversation Engine (HCE) — TypeScript contracts (v2).
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { ClinicalCore, ResolvedAvatar, SessionMessage } from "@/lib/types";

export const HCE_MEMORY_SCHEMA_VERSION = 2;

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

export type AllianceStage =
  | "contact"
  | "disclosure"
  | "vulnerability"
  | "resistance"
  | "repair"
  | "termination";

export type DirectorAction =
  | "answer"
  | "deflect"
  | "partial_disclosure"
  | "full_disclosure"
  | "avoid_topic"
  | "ask_question"
  | "change_subject"
  | "become_emotional"
  | "stay_silent_brief"
  | "interrupt_therapist"
  | "de_escalate"
  | "escalate_distress";

export type DisclosureClass = "deflect" | "partial" | "full" | "withhold";

export type DeliveryTag =
  | "hesitation"
  | "trail_off"
  | "self_correct"
  | "sigh"
  | "nervous_laugh"
  | "whisper"
  | "repeat_word"
  | "false_start"
  | "topic_shift"
  | "filler_words"
  | "cry"
  | "long_pause";

export type EmotionVector = {
  sadness: number;
  anxiety: number;
  anger: number;
  hope: number;
  fatigue: number;
};

/** Hidden from therapist — shapes responses only (Layer 4). */
export type HceInternalState = {
  trust: number;
  fear: number;
  attachment: number;
  suspicion: number;
  hope: number;
  resistance: number;
  fatigue: number;
  motivation: number;
  suicidality: number;
  insight: number;
  alliance_stage: AllianceStage;
};

export type EpisodicMemory = {
  id: string;
  fact: string;
  turn: number;
  topics: string[];
};

export type EmotionalMemory = {
  id: string;
  feeling: string;
  trigger: string;
  turn: number;
  intensity: number;
};

export type LongitudinalSummary = {
  session_count: number;
  last_session_tone: "warm" | "neutral" | "strained";
  last_session_ended_well: boolean;
  recurring_themes: string[];
  emotional_carryover: string;
  last_updated_at: string;
};

export type HceMemoryState = {
  schema_version: number;
  episodic: EpisodicMemory[];
  emotional_episodic: EmotionalMemory[];
  relationship: {
    alliance: number;
    last_tone: "warm" | "neutral" | "strained";
  };
  internal: HceInternalState;
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
    vector: EmotionVector;
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
  longitudinal?: LongitudinalSummary;
};

export type CaseMemoryRow = {
  case_instance_id: string;
  memory: Record<string, unknown>;
  longitudinal_group_id?: string | null;
};

export type TurnBrief = {
  turn_goal: string;
  alliance_target: string;
  director_action: DirectorAction;
  disclosure_class: DisclosureClass;
  clinical_directives: string[];
  emotion_directives: string[];
  behavior_directives: string[];
  voice_directives: string[];
  delivery_directives: string[];
  constraints: string[];
  reasoning_mode: ReasoningMode;
  therapist_move: TherapistMove;
  patient_should_interrupt: boolean;
};

export type MemoryEngineOutput = {
  recalled_facts: string[];
  emotional_recall: string[];
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
  vector: EmotionVector;
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

export type TimingEngineOutput = {
  pause_before_ms: number;
  speech_rate: number;
  should_interrupt: boolean;
};

export type VoiceEngineOutput = {
  stability: number;
  similarity_boost: number;
  style: number;
  pause_before_ms: number;
  speech_rate: number;
  volume_hint: number;
  tremor_hint: number;
  breathiness_hint: number;
  directives: string[];
};

export type EngineSnapshots = {
  memory: MemoryEngineOutput;
  emotion: EmotionEngineOutput;
  clinical: ClinicalEngineOutput;
  environment: EnvironmentEngineOutput;
  behavior: BehaviorEngineOutput;
  voice: VoiceEngineOutput;
  timing: TimingEngineOutput;
  internal: HceInternalState;
};

export type GptTurnOutput = {
  patient_utterance: string;
  memory_writes?: Array<{ key: string; value: string; ttl?: number }>;
  emotional_memory_writes?: Array<{
    feeling: string;
    trigger: string;
    intensity?: number;
  }>;
  emotion_delta?: { primary?: AffectPrimary; intensity_delta?: number };
  clinical_events?: Array<{ type: string; topic?: string }>;
  delivery_tags?: DeliveryTag[];
  voice_markup?: { breaks?: number[]; emphasis?: string[] };
};

export type HceVoiceHints = VoiceEngineOutput & {
  voice_markup?: GptTurnOutput["voice_markup"];
  delivery_tags?: DeliveryTag[];
  stream_chunks?: string[];
};

export type HceTurnResult = {
  text: string;
  aiSource: "gpt" | "gateway" | "persona_fallback";
  model?: string;
  errorKind?: string;
  reasoningMode: ReasoningMode;
  voiceHints: HceVoiceHints;
  alliance: number;
  trust: number;
  directorAction: DirectorAction;
  disclosureClass: DisclosureClass;
  emotionVector: EmotionVector;
  deliveryTags: DeliveryTag[];
  patientInterrupt: boolean;
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
  /** Client signaled therapist barge-in while patient was speaking. */
  therapistBargeIn?: boolean;
};

export type HceSessionSignals = {
  final_alliance: number;
  final_trust: number;
  disclosure_depth: number;
  missed_safety: boolean;
  alliance_ruptures: number;
  successful_repairs: number;
  emotional_triggers_fired: number;
  avg_response_latency_ms: number;
  hce_turn_count: number;
};

export type ClinicalCoreContext = ClinicalCore;

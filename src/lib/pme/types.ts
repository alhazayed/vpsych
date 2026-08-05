/**
 * Patient Mind Engine — core state contracts (Mission 21).
 * The LLM may ONLY express this state; it must not invent psychology.
 */

export const PME_VERSION = "1.0.0";

export type SessionPhase =
  | "opening"
  | "rapport"
  | "exploration"
  | "resistance"
  | "disclosure"
  | "reflection"
  | "closure"
  | "carry_over";

export type DefenseId =
  | "denial"
  | "avoidance"
  | "projection"
  | "rationalization"
  | "intellectualization"
  | "minimization"
  | "splitting"
  | "humor"
  | "passive_aggression"
  | "silence"
  | "topic_shifting";

export type DisclosureTopicId =
  | "trauma"
  | "sexual_abuse"
  | "psychosis"
  | "suicidal_thoughts"
  | "self_harm"
  | "substance_use"
  | "family_conflict"
  | "shame"
  | "medication_nonadherence";

/** Continuous disclosure readiness 0–100 (never binary). */
export type DisclosureTopicState = {
  topic: DisclosureTopicId;
  readiness: number;
  times_approached: number;
  times_partially_disclosed: number;
  last_level: "closed" | "hinted" | "partial" | "open";
};

export type EmotionalState = {
  /** Baseline temperament for this case (slow-moving). */
  baseline_mood: number; // 0 bleak … 100 elevated
  activation: number;
  fatigue: number;
  hope: number;
  fear: number;
  anger: number;
  trust: number;
  shame: number;
  guilt: number;
  helplessness: number;
};

export type RelationshipMemory = {
  therapist_id: string | null;
  warmth_cumulative: number;
  empathy_cumulative: number;
  confrontation_count: number;
  rupture_count: number;
  repair_count: number;
  broken_promises: string[];
  therapist_style_notes: string[];
  sessions_together: number;
  last_session_summary: string | null;
  trust: number; // 0–100, never resets abruptly
  alliance: number; // 0–100
};

export type TherapyProgress = {
  session_index: number;
  phase: SessionPhase;
  turns_in_phase: number;
  motivation: number; // readiness for change 0–100
  insight: number;
  symptom_burden: number; // 0–100 higher = more symptomatic
  medication_adherence: number; // 0–100
  coping_style: string;
};

export type LifeEvent = {
  id: string;
  kind: string;
  description: string;
  valence: "negative" | "mixed" | "positive";
  impact: Partial<EmotionalState> & { symptom_delta?: number };
  occurred_at: string;
  carried_into_session: boolean;
};

export type ClinicalDynamics = {
  disorder_slug: string;
  category: string | null;
  /** Disorder-specific flags the expression layer must honour. */
  behaviour_directives: string[];
  risk_level: "none" | "low" | "moderate" | "high";
};

export type TurnTrace = {
  at: string;
  therapist_cues: string[];
  defenses_active: DefenseId[];
  phase: SessionPhase;
  alliance: number;
  trust: number;
};

/**
 * Hidden evolving psychology. Expression engine receives a projection of this.
 */
export type PatientMindState = {
  pme_version: string;
  case_instance_id: string | null;
  longitudinal_group_id: string | null;
  learner_id: string | null;
  diagnosis: {
    slug: string;
    name: string;
    category: string | null;
    comorbidities: string[];
  };
  personality: {
    interpersonal_style: string;
    cognitive_style: string;
    attachment: string;
  };
  relationship: RelationshipMemory;
  disclosure: DisclosureTopicState[];
  current_defenses: DefenseId[];
  emotional_state: EmotionalState;
  clinical: ClinicalDynamics;
  therapy: TherapyProgress;
  life_events: LifeEvent[];
  memory: {
    salient_facts: string[];
    avoided_topics: string[];
    preferred_topics: string[];
  };
  turn_traces: TurnTrace[];
  updated_at: string;
  created_at: string;
};

/** Structured directive passed to the LLM expression layer — not free invention. */
export type ExpressionDirective = {
  pme_version: string;
  phase: SessionPhase;
  affect_summary: string;
  alliance: number;
  trust: number;
  motivation: number;
  active_defenses: DefenseId[];
  defense_guidance: string[];
  disclosure_guidance: string[];
  clinical_behaviour: string[];
  relationship_notes: string[];
  life_event_carry: string | null;
  speech_constraints: string[];
  /** Absolute: do not invent state contradicting these. */
  hard_constraints: string[];
};

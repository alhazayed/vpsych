/**
 * Mission 8 — Patient Adaptation Engine contracts.
 *
 * Patients react differently depending on therapist behaviour:
 *   warm → rapport grows faster
 *   judgmental → patient withdraws
 *   interruptions → anger
 *   excellent empathy → earlier disclosure
 *
 * State evolves across turns and treatment sessions. Never hard-resets.
 */

export const ADAPTATION_VERSION = "1.0.0";

/** Detected therapist behavioural cues for one turn. */
export type TherapistBehaviourCue =
  | "warmth"
  | "judgment"
  | "interruption"
  | "excellent_empathy"
  | "confrontation"
  | "repair"
  | "validation"
  | "curt";

/** Observable patient stance driven by adaptation. */
export type PatientStance =
  | "opening"
  | "engaging"
  | "guarded"
  | "withdrawn"
  | "angry"
  | "disclosing"
  | "reparable";

export type TherapistTurnSignals = {
  warmth: number;
  judgment: number;
  interruption: number;
  empathy: number;
  excellent_empathy: number;
  confrontation: number;
  validation: number;
  repair: boolean;
  cues: TherapistBehaviourCue[];
};

/**
 * Rapport Model — alliance warmth / felt connection.
 * Velocity rises under sustained warmth so rapport accumulates faster.
 */
export type RapportState = {
  /** 0–100 felt rapport. */
  level: number;
  /**
   * Growth multiplier (typically 0.5–2.0). Warm streaks raise it;
   * judgment resets toward baseline.
   */
  velocity: number;
  warmth_streak: number;
  judgment_hits: number;
  sessions_together: number;
};

/**
 * Trust Model — safety to disclose / rely on the therapist.
 * Moves gradually; never jumps more than the per-turn cap.
 */
export type TrustState = {
  /** 0–100 relational trust. */
  level: number;
  rupture_count: number;
  repair_count: number;
  empathy_streak: number;
};

/** Downstream behavioural effects the expression layer enacts. */
export type AdaptationEffects = {
  /** 0–100 — higher → shorter answers, topic shifts, polite distance. */
  withdrawal: number;
  /** 0–100 — higher → irritability, clipped affect, testing. */
  anger: number;
  /** 0–100 — readiness to open a deeper disclosure layer this turn. */
  disclosure_readiness: number;
  /** 0–100 — willingness to stay with the therapist's focus. */
  engagement: number;
};

export type TreatmentArc = {
  cumulative_warmth: number;
  cumulative_empathy: number;
  cumulative_judgment: number;
  cumulative_interruptions: number;
  /** Sessions completed with this therapist (carries across treatment). */
  sessions_completed: number;
};

export type AdaptationTurnTrace = {
  at: string;
  cues: TherapistBehaviourCue[];
  rapport: number;
  trust: number;
  stance: PatientStance;
  disclosure_readiness: number;
};

/**
 * Full patient adaptation state — persisted in case_memory.memory.patient_adaptation.
 */
export type PatientAdaptationState = {
  adaptation_version: string;
  case_instance_id: string | null;
  therapist_id: string | null;
  rapport: RapportState;
  trust: TrustState;
  effects: AdaptationEffects;
  stance: PatientStance;
  session_index: number;
  turn_count: number;
  treatment_arc: TreatmentArc;
  turn_traces: AdaptationTurnTrace[];
  updated_at: string;
};

/** What the LLM must enact this turn (expression-only). */
export type AdaptationDirective = {
  stance: PatientStance;
  rapport: number;
  trust: number;
  withdrawal: number;
  anger: number;
  disclosure_readiness: number;
  engagement: number;
  enact: string[];
};

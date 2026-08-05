/**
 * Therapy Response Engine (TRE) — Excellence Program 1.
 * PME defines WHO the patient is; TRE defines HOW they change over treatment.
 */

export const TRE_VERSION = "1.0.0";
export const TRI_VERSION = "1.0.0";

export type TreModality =
  | "supportive"
  | "cbt"
  | "dbt"
  | "motivational_interviewing"
  | "act"
  | "psychodynamic"
  | "family_psychoeducation"
  | "crisis_intervention";

export type TrajectoryLabel =
  | "improving"
  | "worsening"
  | "plateau"
  | "relapse"
  | "disengaged";

/** Clinical outcome channels influenced by therapy (0–100). */
export type TreatmentOutcomes = {
  /** Higher = more symptomatic (aligned with PME symptom_burden). */
  symptoms: number;
  /** Higher = more adaptive cognition. */
  cognition: number;
  /** Higher = better emotion regulation. */
  emotion_regulation: number;
  insight: number;
  /** Higher = better day-to-day functioning. */
  functioning: number;
  /** Higher = more ready to disclose. */
  disclosure_openness: number;
  trust: number;
  hope: number;
  /** Higher = greater near-term relapse risk. */
  relapse_risk: number;
  engagement: number;
  homework_adherence: number;
};

export type SessionTreatmentRecord = {
  session_index: number;
  modality: TreModality;
  therapist_competence: number; // 0–100
  alliance_mean: number;
  medication_adherence: number;
  life_event_valence: "negative" | "mixed" | "positive" | "none";
  deltas: Partial<TreatmentOutcomes>;
  trajectory_after: TrajectoryLabel;
  notes: string[];
  at: string;
};

export type TreatmentState = {
  tre_version: string;
  modality: TreModality;
  resilience: number; // 0–100 trait-like buffer
  personality_factor: number; // modifiers from attachment/style
  outcomes: TreatmentOutcomes;
  sessions: SessionTreatmentRecord[];
  trajectory: TrajectoryLabel;
  updated_at: string;
};

export type TreSessionInput = {
  modality: TreModality;
  /** Derived from interview quality (alliance, empathy, skill cues). */
  therapist_competence: number;
  alliance_mean: number;
  medication_adherence: number;
  disorder_slug: string;
  disorder_category?: string | null;
  resilience?: number;
  personality_attachment?: string;
  life_event_valence?: "negative" | "mixed" | "positive" | "none";
  /** Prior treatment state; null seeds defaults from mind. */
  prior?: TreatmentState | null;
  session_index: number;
};

export type TreApplyResult = {
  treatment: TreatmentState;
  /** Deltas to sync into PatientMindState. */
  mind_patch: {
    symptom_burden: number;
    insight: number;
    motivation: number;
    medication_adherence: number;
    hope: number;
    trust: number;
    disclosure_readiness_boost: number;
    clinical_notes: string[];
  };
};

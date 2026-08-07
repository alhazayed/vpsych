/**
 * Clinical Intelligence runtime objects (Stage 6).
 *
 * Implements Stage 5 Clinical Intelligence Framework as typed runtime state —
 * NOT a parallel patient mind or a replacement for Case / Emotion / Adaptation /
 * CBE / HPE / LTM. Ownership remains with those engines; this layer defines
 * shared shapes, façades, promotion, and longitudinal helpers.
 *
 * Fiction boundary: educational synthetic patients only.
 */

import type { TherapyModality } from "@/lib/case-engine/types";
import type { PatientStance } from "@/lib/adaptation/types";
import type { EmotionMode } from "@/lib/emotion/types";
import type {
  ConversationBehaviourKind,
  DisclosureGate,
} from "@/lib/conversation-behaviour/types";
import type {
  AttachmentStyle,
  CopingStyle,
  EmotionalRegulationStyle,
} from "@/lib/personality-engine/types";

export const CLINICAL_INTELLIGENCE_VERSION = "1.0.0" as const;
export const FORMULATION_VERSION = 1 as const;
export const MSE_VERSION = 1 as const;
export const THERAPY_RESPONSE_VERSION = 1 as const;
export const MIND_STATE_VERSION = 1 as const;

/** 0–100 clamped clinical continuum. */
export type Continuum100 = number;

export type ImpairmentBand = "intact" | "mild" | "moderate" | "severe";

export type InsightBand =
  | "absent"
  | "poor"
  | "partial"
  | "good"
  | "intellectual_only";

export type BeliefDomain = "self" | "others" | "world" | "future";

export type BeliefSalience = "presenting" | "elicited" | "hidden";

export type BeliefSource = "authored" | "package_seed" | "session_derived";

export type ProtectiveCategory =
  | "family"
  | "religion"
  | "purpose"
  | "children"
  | "employment"
  | "hope"
  | "therapeutic_alliance"
  | "treatment"
  | "social_support"
  | "future_goals"
  | "social"
  | "personal"
  | "clinical"
  | "cultural"
  | "other";

export type CoreBelief = {
  id: string;
  statement: string;
  domain: BeliefDomain;
  strength: Continuum100;
  salience: BeliefSalience;
  source: BeliefSource;
  linked_schema_ids?: string[];
  linked_symptom_ids?: string[];
};

/** Structured core beliefs — Case Engine formulation owner. */
export type BeliefSystem = {
  version: typeof FORMULATION_VERSION;
  core_beliefs: CoreBelief[];
};

export type CoreValue = {
  id: string;
  label: string;
  narrative?: string;
  weight: Continuum100;
  locale_notes?: string;
};

export type CoreValues = CoreValue[];

/**
 * Identity overlay — projection only. Locale identity + ClinicalCore + HPE
 * remain canonical; this does not fork a second Patient type.
 */
export type IdentityModel = {
  display_name: string;
  age: number;
  gender: string;
  occupation?: string;
  culture?: string;
  religion?: string;
  /** BPD / identity disturbance educational band only. */
  identity_disturbance_band?: ImpairmentBand;
};

/** Re-export HPE attachment — do not redefine. */
export type { AttachmentStyle };

export type ProtectiveFactor = {
  id: string;
  label: string;
  category: ProtectiveCategory;
  strength?: Continuum100;
  narrative?: string;
};

export type RiskFactorTag = {
  id: string;
  label: string;
  kind: "static" | "dynamic";
  narrative?: string;
};

export type SelfEsteem = {
  global: Continuum100;
  domains?: Array<{ id: string; score: Continuum100 }>;
  narrative?: string;
};

export type InsightState = {
  band: InsightBand;
  mse_narrative?: string;
  /** When false, curriculum forbids mid-arc insight drift. */
  mutable: boolean;
};

export type ExecutiveFunction = {
  planning: ImpairmentBand;
  inhibition: ImpairmentBand;
  flexibility: ImpairmentBand;
  working_memory?: ImpairmentBand;
  fluctuating?: boolean;
  linked_symptom_ids?: string[];
};

export type CognitiveDistortion = {
  id: string;
  distortion_kind: string;
  example_thought?: string;
  activation_topics: string[];
  salience: BeliefSalience;
};

export type AutomaticThought = {
  id: string;
  content: string;
  trigger_topics: string[];
  linked_belief_id?: string;
  linked_distortion_ids?: string[];
  hotness: Continuum100;
  disclosed: boolean;
};

export type CoreSchema = {
  id: string;
  if_condition: string;
  then_pattern: string;
  linked_belief_ids: string[];
  defence_bias?: string;
  /** Reference HPE CopingStyle — do not redefine. */
  coping_bias?: CopingStyle;
};

export type CoreSchemas = CoreSchema[];

export type DefenseMechanism = {
  id: string;
  mechanism: string;
  intensity: Continuum100;
  topics: string[];
  cbe_kind_bias?: ConversationBehaviourKind;
};

/** Trait coping — owned by HPE; mirrored here for formulation completeness. */
export type CopingStrategies = {
  primary: CopingStyle;
  secondary?: CopingStyle[];
  notes?: string;
};

export type EmotionRegulation = {
  /** Trait style from HPE. */
  trait_style: EmotionalRegulationStyle;
  /** Optional state effectiveness 0–100 (Emotion-side). */
  effectiveness?: Continuum100;
};

export type TherapyAlliance = {
  rapport: Continuum100;
  trust: Continuum100;
  stance: PatientStance;
  disclosure_readiness: Continuum100;
  engagement: Continuum100;
  withdrawal: Continuum100;
  anger: Continuum100;
  sessions_together: number;
};

export type AdherenceBand = "none" | "partial" | "full" | "unknown";

export type HomeworkAdherence = {
  assigned: boolean;
  completed_band: Exclude<AdherenceBand, "unknown"> | "none";
  barriers?: string[];
  last_assignment_summary?: string;
};

export type MedicationAdherence = {
  regimen_summary?: string;
  adherence_band: AdherenceBand;
  side_effect_complaint?: string;
};

export type TreatmentAdherence = {
  attendance_band: "regular" | "intermittent" | "dropout_risk" | "unknown";
  /** Composite 0–100 derived from homework + medication + alliance. */
  overall: Continuum100;
  homework: HomeworkAdherence;
  medication: MedicationAdherence;
};

export type RecoveryStage =
  | "intake"
  | "early_alliance"
  | "engaged_work"
  | "partial_response"
  | "plateau"
  | "relapse_risk"
  | "relapse"
  | "dropout_risk"
  | "dropped_out"
  | "re_intake"
  | "recovery"
  | "maintenance";

export type EvolutionHorizon = 1 | 5 | 10 | 25 | 50 | 100 | "none";

export type RecoveryTrajectory = {
  stage: RecoveryStage;
  horizon: EvolutionHorizon;
  sessions_completed: number;
  fork?: string;
  progressive_severity?: boolean;
  pin_disorder?: boolean;
};

export type RelapseRisk = {
  level: "none" | "elevated" | "high";
  score?: Continuum100;
  triggers: string[];
};

export type CrisisRisk = {
  /** True when Emotion / RiskProfile indicate crisis-band operation. */
  band: boolean;
  mode?: "crisis_band";
};

export type StressReservoir = {
  /** Mirror of Emotion.stress (acute). */
  acute: Continuum100;
  /** Slow chronic load across sessions. */
  chronic_load: Continuum100;
};

export type BehaviorProfile = {
  pattern_tags: string[];
  disclosure: DisclosureGate;
  act: ConversationBehaviourKind | "cooperate" | "refuse_explicit";
  stance: PatientStance;
  affect_mode: EmotionMode;
  engagement?: Continuum100;
  secondary_acts?: ConversationBehaviourKind[];
};

export type CognitiveMove =
  | "activate_schema"
  | "ruminate"
  | "problem_solve"
  | "blank";

export type DissociationBias = "none" | "mild_detachment" | "marked";

export type ImprovementSignal =
  | "none"
  | "alliance"
  | "insight"
  | "adherence";

/**
 * PatientDecisionPlan — façade over Adaptation + Emotion + CBE (+ formulation).
 * Engines decide; model speaks. Never announce labels in patient voice.
 */
export type PatientDecisionPlan = {
  version: 1;
  disclosure: DisclosureGate;
  act: ConversationBehaviourKind | "cooperate" | "refuse_explicit";
  affect_mode: EmotionMode;
  stance: PatientStance;
  cognitive_move?: CognitiveMove;
  dissociation?: DissociationBias;
  improvement_signal?: ImprovementSignal;
  speak: "llm" | "direct" | "silence_hold";
  /** Active schema / AT ids this turn (hidden from patient voice). */
  activated_schema_ids?: string[];
  activated_thought_ids?: string[];
  /** Observability — never clinical truth for the trainee UI. */
  meta: {
    modality?: TherapyModality | null;
    therapy_bias?: string[];
    defence_ids?: string[];
  };
};

/** Ephemeral decision state for tracing / CI namespace. */
export type DecisionState = {
  plan: PatientDecisionPlan;
  turn_index: number;
  at: string;
};

export type MentalStatusExam = {
  version: typeof MSE_VERSION;
  appearance?: string;
  behavior?: string;
  speech?: string;
  mood?: string;
  affect?: string;
  thought_process?: string;
  thought_content?: string;
  perception?: string;
  insight: InsightBand;
  judgement?: string;
  cognition?: string;
  risk_summary?: string;
};

/**
 * Patient formulation — Case Engine teaching package.
 * patient_goals ≠ ClinicalCore.session_goals (trainee targets).
 */
export type PatientFormulation = {
  version: typeof FORMULATION_VERSION;
  belief_system: BeliefSystem;
  values: CoreValues;
  schemas: CoreSchemas;
  distortions: CognitiveDistortion[];
  automatic_thoughts_seed: AutomaticThought[];
  self_esteem?: SelfEsteem;
  patient_goals?: string[];
  executive?: ExecutiveFunction;
  defense_mechanisms?: DefenseMechanism[];
  insight?: InsightState;
};

export type TherapyResponseBiases = {
  trust_gate?: boolean;
  validation_required?: boolean;
  advice_sensitivity?: "low" | "medium" | "high";
  exposure_readiness?: "none" | "low" | "moderate";
  defence_on_interpretation?: boolean;
  homework_sensitivity?: "low" | "medium" | "high";
};

/**
 * Typed therapy response profile — replaces thin reaction string bags.
 * Additive; old 3-field JSON still parses via normalizeTherapyResponseProfile.
 */
export type TherapyResponseProfile = {
  version: typeof THERAPY_RESPONSE_VERSION;
  modality: TherapyModality;
  engages_with: string[];
  resists: string[];
  alliance_cue: string;
  response_biases: TherapyResponseBiases;
};

/** Structured therapist intervention classes that modify internal state. */
export type TherapyInterventionKind =
  | "cbt"
  | "dbt"
  | "act"
  | "psychodynamic"
  | "supportive"
  | "motivational_interviewing"
  | "psychoeducation"
  | "validation"
  | "reflection"
  | "silence"
  | "confrontation"
  | "homework_review"
  | "risk_assessment"
  | "empathy"
  | "advice"
  | "hostility"
  | "other";

export type TherapyEffectDeltas = {
  hope?: number;
  trust?: number;
  motivation?: number;
  stress?: number;
  anger?: number;
  self_esteem?: number;
  alliance_rapport?: number;
  alliance_trust?: number;
  disclosure_readiness?: number;
  homework_adherence?: number;
  insight_nudge?: number;
  chronic_stress?: number;
};

export type TherapyEffectProfile = {
  intervention: TherapyInterventionKind;
  deltas: TherapyEffectDeltas;
  notes: string[];
};

/**
 * Mutable clinical intelligence working state in case_memory.memory.clinical_intelligence.
 * Does not own Emotion or Adaptation stores (OWN-01 / OWN-02).
 */
export type ClinicalIntelligenceMindState = {
  version: typeof MIND_STATE_VERSION;
  clinical_intelligence_version: typeof CLINICAL_INTELLIGENCE_VERSION;
  case_instance_id: string | null;
  /** Working automatic thoughts (may disclose over turns). */
  active_automatic_thoughts: AutomaticThought[];
  /** Softened belief strengths (statements stay frozen on snapshot). */
  belief_strength_overrides: Record<string, Continuum100>;
  self_esteem_global?: Continuum100;
  insight_band?: InsightBand;
  adherence: TreatmentAdherence;
  recovery: RecoveryTrajectory;
  relapse_risk: RelapseRisk;
  stress_reservoir: StressReservoir;
  crisis_risk: CrisisRisk;
  decision_traces: DecisionState[];
  updated_at: string;
};

/** Extended LTM categories (additive — do not replace existing). */
export const CI_MEMORY_CATEGORIES = [
  "episodic",
  "semantic",
  "therapy",
  "relationship",
  "trauma",
  "belief",
  "emotional",
  "behavioral",
  "goal",
  "protective",
  "risk",
] as const;

export type CiMemoryCategory = (typeof CI_MEMORY_CATEGORIES)[number];

/**
 * Adaptation Engine — orchestrates Rapport + Trust into patient behavioural change.
 *
 * Warm therapist → rapport grows faster
 * Judgmental therapist → patient withdraws
 * Interruptions → anger
 * Excellent empathy → earlier disclosure
 * State evolves across the treatment arc.
 */

import { updateRapport, createRapportState, carryRapportToNextSession } from "@/lib/adaptation/rapport";
import { updateTrust, createTrustState, carryTrustToNextSession } from "@/lib/adaptation/trust";
import { signalTherapistBehaviour, clamp01to100 } from "@/lib/adaptation/signals";
import {
  buildAdaptationDirective,
  formatAdaptationBlock,
} from "@/lib/adaptation/expression";
import type {
  AdaptationEffects,
  AdaptationTurnTrace,
  PatientAdaptationState,
  PatientStance,
  TherapistTurnSignals,
  TreatmentArc,
} from "@/lib/adaptation/types";
import { ADAPTATION_VERSION } from "@/lib/adaptation/types";

export type ProcessAdaptationResult = {
  state: PatientAdaptationState;
  signals: TherapistTurnSignals;
  directive: ReturnType<typeof buildAdaptationDirective>;
  expressionBlock: string;
};

function createEffects(): AdaptationEffects {
  return {
    withdrawal: 25,
    anger: 12,
    disclosure_readiness: 28,
    engagement: 45,
  };
}

function createArc(): TreatmentArc {
  return {
    cumulative_warmth: 0,
    cumulative_empathy: 0,
    cumulative_judgment: 0,
    cumulative_interruptions: 0,
    sessions_completed: 0,
  };
}

export function createAdaptationState(opts?: {
  caseInstanceId?: string | null;
  therapistId?: string | null;
  sessionIndex?: number;
  /** Slightly warmer starting rapport for returning / familiar patients. */
  priorRapport?: number;
  priorTrust?: number;
}): PatientAdaptationState {
  const now = new Date().toISOString();
  return {
    adaptation_version: ADAPTATION_VERSION,
    case_instance_id: opts?.caseInstanceId ?? null,
    therapist_id: opts?.therapistId ?? null,
    rapport: createRapportState(1, opts?.priorRapport ?? 38),
    trust: createTrustState(opts?.priorTrust ?? 40),
    effects: createEffects(),
    stance: "opening",
    session_index: opts?.sessionIndex ?? 1,
    turn_count: 0,
    treatment_arc: createArc(),
    turn_traces: [],
    updated_at: now,
  };
}

function deriveStance(
  effects: AdaptationEffects,
  signals: TherapistTurnSignals,
  rapport: number,
  trust: number,
): PatientStance {
  if (signals.repair && effects.anger > 30) return "reparable";
  if (effects.anger >= 55) return "angry";
  if (effects.withdrawal >= 60) return "withdrawn";
  if (effects.disclosure_readiness >= 62 && trust >= 55) return "disclosing";
  if (rapport >= 55 && effects.engagement >= 55) return "engaging";
  if (effects.withdrawal >= 40 || trust < 35) return "guarded";
  return "opening";
}

/**
 * Update behavioural effects from the mission rules.
 */
export function applyAdaptationEffects(
  prev: AdaptationEffects,
  signals: TherapistTurnSignals,
  rapportLevel: number,
  trustLevel: number,
): AdaptationEffects {
  let withdrawal = prev.withdrawal;
  let anger = prev.anger;
  let disclosure = prev.disclosure_readiness;
  let engagement = prev.engagement;

  // Judgmental therapist → patient withdraws
  if (signals.judgment >= 8) {
    withdrawal += 10 + signals.judgment * 0.35;
    engagement -= 8;
    disclosure -= 6;
  }

  // Interruptions → anger
  if (signals.interruption >= 8) {
    anger += 12 + signals.interruption * 0.4;
    engagement -= 6;
    withdrawal += 4;
  }

  // Warmth / rapport → engagement up, withdrawal down
  if (signals.warmth >= 8) {
    withdrawal -= 5;
    engagement += 6;
    anger -= 3;
  }

  // Excellent empathy → earlier disclosure
  if (signals.excellent_empathy >= 10) {
    disclosure += 10 + signals.excellent_empathy * 0.25;
    withdrawal -= 4;
    engagement += 5;
  } else if (signals.empathy >= 8) {
    disclosure += 4;
  }

  if (signals.repair) {
    anger -= 8;
    withdrawal -= 5;
    engagement += 4;
  }

  if (signals.confrontation >= 10 && signals.empathy < 5) {
    withdrawal += 6;
    anger += 5;
  }

  // Blend with rapport/trust levels (slow coupling)
  disclosure = disclosure * 0.7 + trustLevel * 0.2 + rapportLevel * 0.1;
  engagement = engagement * 0.75 + rapportLevel * 0.25;
  withdrawal = withdrawal * 0.85 + (100 - trustLevel) * 0.1;

  // Soft decay toward baselines so states don't lock forever
  anger = anger * 0.92;
  withdrawal = withdrawal * 0.96;

  return {
    withdrawal: clamp01to100(withdrawal),
    anger: clamp01to100(anger),
    disclosure_readiness: clamp01to100(disclosure),
    engagement: clamp01to100(engagement),
  };
}

/**
 * Advance patient adaptation given one therapist utterance.
 */
export function processTherapistTurn(
  state: PatientAdaptationState,
  therapistText: string,
): ProcessAdaptationResult {
  const signals = signalTherapistBehaviour(therapistText);
  const next: PatientAdaptationState = structuredClone(state);

  next.rapport = updateRapport(next.rapport, signals);
  next.trust = updateTrust(next.trust, signals);
  next.effects = applyAdaptationEffects(
    next.effects,
    signals,
    next.rapport.level,
    next.trust.level,
  );
  next.stance = deriveStance(
    next.effects,
    signals,
    next.rapport.level,
    next.trust.level,
  );

  next.treatment_arc = {
    ...next.treatment_arc,
    cumulative_warmth:
      next.treatment_arc.cumulative_warmth + signals.warmth,
    cumulative_empathy:
      next.treatment_arc.cumulative_empathy +
      signals.empathy +
      signals.excellent_empathy,
    cumulative_judgment:
      next.treatment_arc.cumulative_judgment + signals.judgment,
    cumulative_interruptions:
      next.treatment_arc.cumulative_interruptions + signals.interruption,
  };

  next.turn_count += 1;
  const trace: AdaptationTurnTrace = {
    at: new Date().toISOString(),
    cues: signals.cues,
    rapport: next.rapport.level,
    trust: next.trust.level,
    stance: next.stance,
    disclosure_readiness: next.effects.disclosure_readiness,
  };
  next.turn_traces = [...next.turn_traces.slice(-48), trace];
  next.updated_at = trace.at;

  const directive = buildAdaptationDirective(next);
  return {
    state: next,
    signals,
    directive,
    expressionBlock: formatAdaptationBlock(directive),
  };
}

/**
 * Carry adaptation across treatment sessions — patient evolves, does not reset.
 */
export function beginNextSession(
  state: PatientAdaptationState,
): PatientAdaptationState {
  const next: PatientAdaptationState = structuredClone(state);
  next.rapport = carryRapportToNextSession(next.rapport);
  next.trust = carryTrustToNextSession(next.trust);
  next.session_index += 1;
  next.treatment_arc = {
    ...next.treatment_arc,
    sessions_completed: next.treatment_arc.sessions_completed + 1,
  };
  // Soften acute in-session affect; keep disposition shaped by prior work
  next.effects = {
    withdrawal: clamp01to100(next.effects.withdrawal * 0.7 + 18),
    anger: clamp01to100(next.effects.anger * 0.4 + 8),
    disclosure_readiness: clamp01to100(
      next.effects.disclosure_readiness * 0.85 + next.trust.level * 0.1,
    ),
    engagement: clamp01to100(next.effects.engagement * 0.8 + 20),
  };
  next.stance = deriveStance(
    next.effects,
    {
      warmth: 0,
      judgment: 0,
      interruption: 0,
      empathy: 0,
      excellent_empathy: 0,
      confrontation: 0,
      validation: 0,
      repair: false,
      cues: [],
    },
    next.rapport.level,
    next.trust.level,
  );
  next.turn_count = 0;
  next.updated_at = new Date().toISOString();
  return next;
}

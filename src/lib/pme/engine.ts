/**
 * Patient Mind Engine — turn processor.
 * Owns psychology; returns expression directive for the LLM.
 */

import { selectDefenses } from "@/lib/pme/defenses";
import { updateDisclosure } from "@/lib/pme/disclosure";
import {
  buildExpressionDirective,
  formatExpressionBlock,
} from "@/lib/pme/expression";
import {
  applyLongitudinalUpdate,
  markLifeEventCarried,
} from "@/lib/pme/longitudinal";
import { advanceSessionPhase } from "@/lib/pme/session-arc";
import {
  signalTherapistTurn,
  updateRelationship,
} from "@/lib/pme/relationship";
import { applyTherapistEffects } from "@/lib/pme/therapist-effect";
import type {
  ExpressionDirective,
  PatientMindState,
  TurnTrace,
} from "@/lib/pme/types";
import {
  applyTherapyResponseToMind,
  ensureTreatmentState,
  formatTreExpressionBlock,
} from "@/lib/tre/bridge";

export type ProcessTherapistTurnResult = {
  mind: PatientMindState;
  directive: ExpressionDirective;
  expressionBlock: string;
  signals: ReturnType<typeof signalTherapistTurn>;
};

/**
 * Advance the patient's mind given one therapist utterance.
 */
export function processTherapistTurn(
  mind: PatientMindState,
  therapistText: string,
  opts?: { turnIndex?: number },
): ProcessTherapistTurnResult {
  const signals = signalTherapistTurn(therapistText);
  let next: PatientMindState = structuredClone(mind);

  next.relationship = updateRelationship(next.relationship, signals);

  const effects = applyTherapistEffects(
    next.emotional_state,
    next.therapy,
    signals,
  );
  next.emotional_state = effects.emotion;
  next.therapy = effects.therapy;

  const turnIndex = opts?.turnIndex ?? next.turn_traces.length + 1;

  next.disclosure = updateDisclosure(next.disclosure, {
    therapistText,
    relationship: next.relationship,
    emotion: next.emotional_state,
    signals,
    sessionTurn: turnIndex,
  });

  const anyPartial = next.disclosure.some(
    (d) => d.last_level === "partial" || d.last_level === "open",
  );
  next.therapy = advanceSessionPhase(next.therapy, {
    turnIndex,
    relationship: next.relationship,
    signals,
    anyPartialDisclosure: anyPartial,
  });

  next.current_defenses = selectDefenses({
    disorderSlug: next.diagnosis.slug,
    emotion: next.emotional_state,
    relationship: next.relationship,
    phase: next.therapy.phase,
    signals,
  });

  // Sync emotion.trust with relationship trust (slow blend)
  next.emotional_state = {
    ...next.emotional_state,
    trust:
      Math.round(
        (next.emotional_state.trust * 0.6 + next.relationship.trust * 0.4) * 10,
      ) / 10,
  };

  const trace: TurnTrace = {
    at: new Date().toISOString(),
    therapist_cues: signals.cues,
    defenses_active: next.current_defenses,
    phase: next.therapy.phase,
    alliance: next.relationship.alliance,
    trust: next.relationship.trust,
  };
  next.turn_traces = [...next.turn_traces.slice(-40), trace];
  next.updated_at = trace.at;

  const carried = markLifeEventCarried(next);
  next = carried.mind;

  // Ensure TRE state exists; expression layer must honour trajectory.
  next.treatment = ensureTreatmentState(next, next.treatment?.modality);

  const directive = buildExpressionDirective(next, carried.carryText);
  let expressionBlock = formatExpressionBlock(directive);
  expressionBlock +=
    "\n" +
    formatTreExpressionBlock(next.treatment, [
      `Trajectory ${next.treatment.trajectory}; express gradual change only.`,
    ]);

  return {
    mind: next,
    directive,
    expressionBlock,
    signals,
  };
}

/** Prepare mind for a returning patient (new session). */
export function beginNextSession(
  mind: PatientMindState,
  opts?: {
    seed?: string;
    priorAllianceMean?: number;
    modality?: string | null;
  },
): PatientMindState {
  // Life events + session bookkeeping; TRE owns therapeutic change.
  const afterLife = applyLongitudinalUpdate(mind, {
    priorAllianceMean: opts?.priorAllianceMean ?? mind.relationship.alliance,
    generateEvent: true,
    seed: opts?.seed,
    skipTherapyQualityDelta: true,
  });

  const { mind: withTre } = applyTherapyResponseToMind(afterLife, {
    modality: opts?.modality ?? afterLife.treatment?.modality ?? "supportive",
  });

  // Fresh turn traces for the new encounter (competence already scored).
  withTre.turn_traces = [];
  withTre.therapy.phase = "opening";
  withTre.therapy.turns_in_phase = 0;
  return withTre;
}

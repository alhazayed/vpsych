/**
 * Module 9 — Therapist effect model → emotion / motivation deltas.
 */

import type { EmotionalState, TherapyProgress } from "@/lib/pme/types";
import { nudgeEmotion, clamp01to100 } from "@/lib/pme/emotion";
import type { TherapistTurnSignals } from "@/lib/pme/relationship";

export function applyTherapistEffects(
  emotion: EmotionalState,
  therapy: TherapyProgress,
  signals: TherapistTurnSignals,
): { emotion: EmotionalState; therapy: TherapyProgress } {
  const emoDelta: Partial<EmotionalState> = {};

  if (signals.warmth + signals.empathy >= 12) {
    emoDelta.trust = 6;
    emoDelta.fear = -3;
    emoDelta.activation = -2;
  }
  if (signals.validation >= 6) {
    emoDelta.shame = -5;
    emoDelta.hope = 4;
  }
  if (signals.confrontation >= 10) {
    emoDelta.anger = 8;
    emoDelta.trust = -6;
    emoDelta.activation = 6;
  }
  if (signals.poor_empathy >= 6) {
    emoDelta.helplessness = 4;
    emoDelta.trust = -4;
  }
  if (signals.repair) {
    emoDelta.trust = (emoDelta.trust ?? 0) + 5;
    emoDelta.anger = (emoDelta.anger ?? 0) - 4;
  }

  let motivation = therapy.motivation;
  if (signals.mi_skill >= 6) motivation += 5;
  if (signals.cbt_skill >= 5 && signals.empathy >= 5) motivation += 4;
  if (signals.confrontation >= 12) motivation -= 4;

  return {
    emotion: nudgeEmotion(emotion, emoDelta, 0.4),
    therapy: {
      ...therapy,
      motivation: clamp01to100(motivation),
    },
  };
}

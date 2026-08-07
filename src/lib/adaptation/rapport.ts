/**
 * Rapport Model — felt alliance grows faster under warmth, stalls/withdraws under judgment.
 */

import { clamp01to100 } from "@/lib/adaptation/signals";
import type {
  RapportState,
  TherapistTurnSignals,
} from "@/lib/adaptation/types";

const BASELINE_VELOCITY = 1;
const MAX_VELOCITY = 2.2;
const MIN_VELOCITY = 0.45;
/** Hard cap — rapport never jumps more than this per turn. */
const MAX_DELTA = 8;

export function createRapportState(
  sessionsTogether = 1,
  initialLevel = 38,
): RapportState {
  return {
    level: clamp01to100(initialLevel),
    velocity: BASELINE_VELOCITY,
    warmth_streak: 0,
    judgment_hits: 0,
    sessions_together: Math.max(1, sessionsTogether),
  };
}

/**
 * Warm therapist → velocity rises → rapport accumulates faster.
 * Judgmental therapist → velocity drops and level declines.
 */
export function updateRapport(
  rapport: RapportState,
  signals: TherapistTurnSignals,
): RapportState {
  const next: RapportState = { ...rapport };

  if (signals.warmth >= 8 || signals.empathy >= 8) {
    next.warmth_streak += 1;
  } else {
    next.warmth_streak = Math.max(0, next.warmth_streak - 1);
  }

  if (signals.judgment >= 8 || signals.confrontation >= 10) {
    next.judgment_hits += 1;
    next.warmth_streak = 0;
  }

  // Velocity: warm streaks accelerate; judgment brakes hard
  let velocity = next.velocity;
  if (next.warmth_streak >= 2) {
    velocity += 0.18 + Math.min(0.12, next.warmth_streak * 0.03);
  } else if (signals.warmth >= 8) {
    velocity += 0.1;
  }
  if (signals.judgment >= 8) {
    velocity -= 0.35;
  }
  if (signals.interruption >= 12) {
    velocity -= 0.15;
  }
  if (signals.repair) {
    velocity += 0.12;
  }
  next.velocity = Math.max(
    MIN_VELOCITY,
    Math.min(MAX_VELOCITY, Math.round(velocity * 100) / 100),
  );

  let delta =
    (signals.warmth * 0.28 +
      signals.empathy * 0.22 +
      signals.validation * 0.18 +
      (signals.repair ? 3 : 0) -
      signals.judgment * 0.4 -
      signals.confrontation * 0.25 -
      signals.interruption * 0.15) *
    next.velocity;

  // Returning patients with prior warmth start slightly warmer but still gradual
  if (next.sessions_together > 1 && next.warmth_streak >= 1) {
    delta *= 1 + Math.min(0.2, (next.sessions_together - 1) * 0.04);
  }

  delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
  next.level = clamp01to100(next.level + delta);
  return next;
}

/**
 * Carry rapport into the next session — slight overnight decay, velocity soft-resets toward baseline.
 */
export function carryRapportToNextSession(rapport: RapportState): RapportState {
  return {
    ...rapport,
    level: clamp01to100(rapport.level * 0.92 + 4),
    velocity: BASELINE_VELOCITY + (rapport.velocity - BASELINE_VELOCITY) * 0.4,
    warmth_streak: 0,
    sessions_together: rapport.sessions_together + 1,
  };
}

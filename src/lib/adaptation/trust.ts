/**
 * Trust Model — safety to rely on / disclose to the therapist.
 * Evolves gradually; never hard-resets between turns or sessions.
 */

import { clamp01to100 } from "@/lib/adaptation/signals";
import type {
  TherapistTurnSignals,
  TrustState,
} from "@/lib/adaptation/types";

const MAX_DELTA = 6;

export function createTrustState(initialLevel = 40): TrustState {
  return {
    level: clamp01to100(initialLevel),
    rupture_count: 0,
    repair_count: 0,
    empathy_streak: 0,
  };
}

/**
 * Excellent empathy builds trust; judgment and interruptions erode it.
 * Rupture = high judgment/confrontation with little empathy.
 */
export function updateTrust(
  trust: TrustState,
  signals: TherapistTurnSignals,
): TrustState {
  const next: TrustState = { ...trust };

  if (signals.excellent_empathy >= 10 || signals.empathy >= 10) {
    next.empathy_streak += 1;
  } else {
    next.empathy_streak = Math.max(0, next.empathy_streak - 1);
  }

  const rupture =
    (signals.judgment >= 12 || signals.confrontation >= 12) &&
    signals.empathy < 5 &&
    signals.excellent_empathy < 5;
  if (rupture) next.rupture_count += 1;
  if (signals.repair) next.repair_count += 1;

  let delta =
    signals.warmth * 0.18 +
    signals.empathy * 0.3 +
    signals.excellent_empathy * 0.35 +
    signals.validation * 0.22 +
    (signals.repair ? 4.5 : 0) -
    signals.judgment * 0.5 -
    signals.confrontation * 0.35 -
    signals.interruption * 0.28;

  // Sustained excellent empathy compounds slightly (still capped)
  if (next.empathy_streak >= 2 && signals.excellent_empathy >= 10) {
    delta += 1.5;
  }

  delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
  next.level = clamp01to100(next.level + delta);
  return next;
}

/**
 * Between sessions: trust largely persists with mild consolidation toward mid-band.
 */
export function carryTrustToNextSession(trust: TrustState): TrustState {
  const toward = 45;
  const consolidated = trust.level * 0.88 + toward * 0.12;
  return {
    ...trust,
    level: clamp01to100(consolidated),
    empathy_streak: 0,
  };
}

/**
 * Therapist intervention → emotional deltas (Mission 2).
 *
 * Examples from the mission brief:
 *   Validation → trust↑ anger↓
 *   Empathy    → hope↑
 *   Hostility  → withdrawal (trust↓ rapport↓ anger↑ stress↑ motivation↓)
 *
 * Trust gates how much positive interventions land (see applyInterventionDeltas).
 */

import type {
  EmotionalVariables,
  TherapistIntervention,
} from "@/lib/emotion/types";

export type InterventionEffect = {
  deltas: Partial<EmotionalVariables>;
  /** Human-readable clinical note for traces. */
  note: string;
  /** When true, increments withdrawal streak. */
  hostile: boolean;
  /** When true, increments alliance streak. */
  allianceBuilding: boolean;
};

const EFFECTS: Record<TherapistIntervention, InterventionEffect> = {
  validation: {
    deltas: {
      trust: 7,
      anger: -6,
      stress: -3,
      hope: 3,
      rapport: 5,
      current_mood: 4,
    },
    note: "Validation raises trust and lowers anger",
    hostile: false,
    allianceBuilding: true,
  },
  empathy: {
    deltas: {
      hope: 7,
      trust: 5,
      fear: -4,
      rapport: 6,
      current_mood: 5,
      stress: -3,
    },
    note: "Empathy raises hope and softens fear",
    hostile: false,
    allianceBuilding: true,
  },
  reflection: {
    deltas: {
      trust: 4,
      rapport: 4,
      anger: -2,
      current_mood: 2,
    },
    note: "Accurate reflection gently builds alliance",
    hostile: false,
    allianceBuilding: true,
  },
  open_question: {
    deltas: {
      motivation: 3,
      rapport: 2,
      trust: 1,
    },
    note: "Open curiosity invites engagement",
    hostile: false,
    allianceBuilding: false,
  },
  closed_question: {
    deltas: {
      motivation: -1,
      fatigue: 1,
    },
    note: "Closed questions add slight cognitive load",
    hostile: false,
    allianceBuilding: false,
  },
  support: {
    deltas: {
      hope: 5,
      trust: 4,
      current_mood: 4,
      stress: -4,
      rapport: 4,
    },
    note: "Support reduces stress and lifts mood",
    hostile: false,
    allianceBuilding: true,
  },
  psychoeducation: {
    deltas: {
      hope: 3,
      motivation: 4,
      fear: -2,
      stress: -1,
    },
    note: "Psychoeducation can raise motivation when trust exists",
    hostile: false,
    allianceBuilding: false,
  },
  confrontation: {
    deltas: {
      anger: 6,
      stress: 5,
      trust: -3,
      fear: 2,
      motivation: 2,
    },
    note: "Confrontation raises activation; trust cost if premature",
    hostile: false,
    allianceBuilding: false,
  },
  advice: {
    deltas: {
      motivation: -2,
      trust: -2,
      anger: 2,
      hope: -1,
    },
    note: "Premature advice often flattens motivation",
    hostile: false,
    allianceBuilding: false,
  },
  hostility: {
    deltas: {
      trust: -14,
      rapport: -12,
      anger: 12,
      stress: 10,
      fear: 6,
      hope: -8,
      motivation: -10,
      current_mood: -10,
    },
    note: "Hostility drives withdrawal",
    hostile: true,
    allianceBuilding: false,
  },
  invalidation: {
    deltas: {
      trust: -8,
      rapport: -7,
      anger: 8,
      hope: -6,
      current_mood: -6,
      stress: 5,
      motivation: -5,
    },
    note: "Invalidation ruptures alliance",
    hostile: true,
    allianceBuilding: false,
  },
  rupture_repair: {
    deltas: {
      trust: 9,
      rapport: 7,
      anger: -7,
      hope: 5,
      stress: -4,
      current_mood: 5,
      motivation: 4,
    },
    note: "Repair after rupture restores trust when sustained",
    hostile: false,
    allianceBuilding: true,
  },
  safety_check: {
    deltas: {
      trust: 3,
      fear: -2,
      stress: -1,
      rapport: 2,
    },
    note: "Careful safety inquiry can steady fear when done well",
    hostile: false,
    allianceBuilding: false,
  },
  silence: {
    deltas: {
      stress: -1,
      fatigue: 1,
    },
    note: "Therapeutic silence — slight settling or awkwardness",
    hostile: false,
    allianceBuilding: false,
  },
  other: {
    deltas: {},
    note: "Neutral / unclassified move",
    hostile: false,
    allianceBuilding: false,
  },
};

export function effectForIntervention(
  intervention: TherapistIntervention,
): InterventionEffect {
  return EFFECTS[intervention];
}

/**
 * Scale positive (trust-building) deltas by current trust.
 * Low trust → smaller gains from validation/empathy (they don't fully land).
 * Negative deltas from hostility always apply at full strength.
 */
export function trustGatedDeltas(
  deltas: Partial<EmotionalVariables>,
  trust: number,
): Partial<EmotionalVariables> {
  const gate = 0.35 + (Math.max(0, Math.min(100, trust)) / 100) * 0.65;
  const out: Partial<EmotionalVariables> = {};
  for (const [k, v] of Object.entries(deltas) as [
    keyof EmotionalVariables,
    number,
  ][]) {
    if (typeof v !== "number") continue;
    // Positive changes to alliance-relevant vars are gated by trust.
    const gatedKeys: (keyof EmotionalVariables)[] = [
      "trust",
      "rapport",
      "hope",
      "current_mood",
      "motivation",
    ];
    if (v > 0 && gatedKeys.includes(k)) {
      out[k] = Math.round(v * gate * 10) / 10;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function mergeDeltas(
  ...parts: Partial<EmotionalVariables>[]
): Partial<EmotionalVariables> {
  const out: Partial<EmotionalVariables> = {};
  for (const part of parts) {
    for (const [k, v] of Object.entries(part) as [
      keyof EmotionalVariables,
      number,
    ][]) {
      if (typeof v !== "number") continue;
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

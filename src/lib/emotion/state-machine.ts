/**
 * Emotion State Machine — init, tick, decay, mode selection.
 *
 * Dynamics per turn:
 *   1. Classify / accept intervention
 *   2. Apply trust-gated deltas with disorder inertia
 *   3. Decay current_mood / stress / fear / anger toward baseline
 *   4. Fatigue creep from session elapsed time
 *   5. Update withdrawal / alliance streaks → mode
 *   6. Trust remains sticky (slow mean-reversion only)
 */

import { baselineForDisorder, inertiaForDisorder } from "@/lib/emotion/baselines";
import { classifyTherapistIntervention } from "@/lib/emotion/classify";
import {
  effectForIntervention,
  mergeDeltas,
  trustGatedDeltas,
} from "@/lib/emotion/interventions";
import type {
  EmotionInitInput,
  EmotionMode,
  EmotionState,
  EmotionTickInput,
  EmotionTickResult,
  EmotionTransition,
  EmotionalVariables,
  TherapistIntervention,
} from "@/lib/emotion/types";
import {
  EMOTION_ENGINE_VERSION,
  EMOTION_VARIABLE_KEYS,
} from "@/lib/emotion/types";
import { deriveExpression } from "@/lib/emotion/expression";

export function clampEmotion(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export function clampVariables(v: EmotionalVariables): EmotionalVariables {
  const out = { ...v };
  for (const key of EMOTION_VARIABLE_KEYS) {
    out[key] = clampEmotion(out[key]);
  }
  return out;
}

/** Apply a fraction of each delta (inertia). baseline_mood is immutable per tick. */
export function applyDeltas(
  current: EmotionalVariables,
  deltas: Partial<EmotionalVariables>,
  inertia: number,
): EmotionalVariables {
  const next = { ...current };
  for (const key of EMOTION_VARIABLE_KEYS) {
    if (key === "baseline_mood") continue;
    const d = deltas[key];
    if (typeof d !== "number" || d === 0) continue;
    next[key] = clampEmotion(current[key] + d * inertia);
  }
  return next;
}

/**
 * Decay toward baseline. Sticky vars (trust, rapport, motivation) decay slowly.
 * current_mood → baseline_mood; acute stress/fear/anger ease unless withdrawal.
 */
export function decayTowardBaseline(
  vars: EmotionalVariables,
  mode: EmotionMode,
): EmotionalVariables {
  const next = { ...vars };
  const moodPull = mode === "withdrawn" ? 0.06 : 0.12;
  next.current_mood = clampEmotion(
    next.current_mood * (1 - moodPull) + next.baseline_mood * moodPull,
  );

  const acutePull = mode === "activated" ? 0.04 : 0.08;
  for (const key of ["stress", "fear", "anger"] as const) {
    const target =
      key === "stress"
        ? Math.max(30, next.baseline_mood < 40 ? 50 : 40)
        : key === "fear"
          ? Math.max(25, 100 - next.trust) * 0.35
          : 25;
    next[key] = clampEmotion(next[key] * (1 - acutePull) + target * acutePull);
  }

  // Sticky alliance vars — very slow drift
  const stickyPull = 0.02;
  next.trust = clampEmotion(next.trust * (1 - stickyPull) + 40 * stickyPull);
  next.rapport = clampEmotion(
    next.rapport * (1 - stickyPull) + 35 * stickyPull,
  );
  next.motivation = clampEmotion(
    next.motivation * (1 - stickyPull) + 40 * stickyPull,
  );
  next.hope = clampEmotion(
    next.hope * (1 - stickyPull * 2) + next.baseline_mood * stickyPull * 2,
  );

  return next;
}

export function selectMode(
  vars: EmotionalVariables,
  withdrawalStreak: number,
  allianceStreak: number,
): EmotionMode {
  if (withdrawalStreak >= 2 || (vars.trust <= 25 && vars.anger >= 55)) {
    return "withdrawn";
  }
  if (vars.fatigue >= 75 && vars.current_mood <= 30 && vars.hope <= 30) {
    return "collapsed";
  }
  if (vars.stress >= 70 || vars.fear >= 70 || vars.anger >= 65) {
    return "activated";
  }
  if (allianceStreak >= 2 && vars.trust >= 50 && vars.rapport >= 45) {
    return "warming";
  }
  if (vars.trust < 40 || vars.rapport < 35) {
    return "guarded";
  }
  return "engaged";
}

export function initEmotionState(input: EmotionInitInput): EmotionState {
  const now = input.now ?? new Date().toISOString();
  const base = baselineForDisorder(input.disorderSlug);
  const variables = clampVariables({ ...base, ...input.overrides });
  // Keep current_mood aligned with baseline when only baseline overridden
  if (input.overrides?.baseline_mood != null && input.overrides.current_mood == null) {
    variables.current_mood = variables.baseline_mood;
  }
  const mode = selectMode(variables, 0, 0);
  return {
    emotion_engine_version: EMOTION_ENGINE_VERSION,
    case_instance_id: input.caseInstanceId ?? null,
    session_id: input.sessionId ?? null,
    disorder_slug: input.disorderSlug ?? null,
    variables,
    mode,
    turn: 0,
    withdrawal_streak: 0,
    alliance_streak: 0,
    history: [],
    created_at: now,
    updated_at: now,
  };
}

function fatigueFromElapsed(
  vars: EmotionalVariables,
  elapsedSeconds: number | undefined,
): EmotionalVariables {
  if (elapsedSeconds == null || elapsedSeconds <= 0) return vars;
  // +1 fatigue per ~8 minutes, capped contribution +12
  const add = Math.min(12, Math.floor(elapsedSeconds / 480));
  if (add <= 0) return vars;
  return clampVariables({
    ...vars,
    fatigue: vars.fatigue + add * 0.15,
    motivation: vars.motivation - add * 0.08,
  });
}

/**
 * Advance the emotion state machine by one therapist turn.
 */
export function tickEmotion(input: EmotionTickInput): EmotionTickResult {
  const now = input.now ?? new Date().toISOString();
  const disorder =
    input.disorderSlug ?? input.state.disorder_slug ?? null;
  const inertia = inertiaForDisorder(disorder);

  let intervention: TherapistIntervention =
    input.intervention ?? "other";
  let secondary: TherapistIntervention[] = input.secondary ?? [];

  if (!input.intervention && input.therapistMessage != null) {
    const classified = classifyTherapistIntervention(input.therapistMessage);
    intervention = classified.primary;
    secondary = classified.secondary;
  }

  const primaryEffect = effectForIntervention(intervention);
  const secondaryEffects = secondary.map(effectForIntervention);
  const rawDeltas = mergeDeltas(
    primaryEffect.deltas,
    ...secondaryEffects.map((e) => {
      // Secondary moves apply at half strength
      const half: Partial<EmotionalVariables> = {};
      for (const [k, v] of Object.entries(e.deltas) as [
        keyof EmotionalVariables,
        number,
      ][]) {
        if (typeof v === "number") half[k] = v * 0.5;
      }
      return half;
    }),
  );

  const gated = trustGatedDeltas(rawDeltas, input.state.variables.trust);
  let variables = applyDeltas(input.state.variables, gated, inertia);
  variables = fatigueFromElapsed(variables, input.elapsedSeconds);
  variables = decayTowardBaseline(variables, input.state.mode);

  const hostile =
    primaryEffect.hostile || secondaryEffects.some((e) => e.hostile);
  const allianceBuilding =
    primaryEffect.allianceBuilding ||
    secondaryEffects.some((e) => e.allianceBuilding);

  let withdrawalStreak = input.state.withdrawal_streak;
  let allianceStreak = input.state.alliance_streak;
  if (hostile) {
    withdrawalStreak += 1;
    allianceStreak = 0;
  } else if (allianceBuilding) {
    allianceStreak += 1;
    withdrawalStreak = Math.max(0, withdrawalStreak - 1);
  } else {
    withdrawalStreak = Math.max(0, withdrawalStreak - 0); // hold
  }

  // Hostility forces an immediate openness collapse via motivation/trust already
  const mode = selectMode(variables, withdrawalStreak, allianceStreak);

  const notes = [
    primaryEffect.note,
    ...secondaryEffects.map((e) => `secondary: ${e.note}`),
  ];
  if (hostile) notes.push("withdrawal pressure increased");
  if (input.state.variables.trust < 40 && !hostile) {
    notes.push("low trust attenuated positive gains");
  }

  const transition: EmotionTransition = {
    turn: input.state.turn + 1,
    at: now,
    intervention,
    secondary: secondary.length ? secondary : undefined,
    deltas: gated,
    mode_before: input.state.mode,
    mode_after: mode,
    notes,
  };

  const history = [...input.state.history, transition].slice(-40);

  const state: EmotionState = {
    ...input.state,
    disorder_slug: disorder,
    variables,
    mode,
    turn: input.state.turn + 1,
    withdrawal_streak: withdrawalStreak,
    alliance_streak: allianceStreak,
    history,
    updated_at: now,
  };

  return {
    state,
    expression: deriveExpression(state),
    applied: {
      intervention,
      secondary,
      deltas: gated,
    },
  };
}

/** Parse unknown jsonb into EmotionState or null. */
export function parseEmotionState(raw: unknown): EmotionState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!o.variables || typeof o.variables !== "object") return null;
  const v = o.variables as Record<string, unknown>;
  for (const key of EMOTION_VARIABLE_KEYS) {
    if (typeof v[key] !== "number") return null;
  }
  if (typeof o.mode !== "string") return null;
  return {
    emotion_engine_version:
      typeof o.emotion_engine_version === "string"
        ? o.emotion_engine_version
        : EMOTION_ENGINE_VERSION,
    case_instance_id:
      typeof o.case_instance_id === "string" ? o.case_instance_id : null,
    session_id: typeof o.session_id === "string" ? o.session_id : null,
    disorder_slug: typeof o.disorder_slug === "string" ? o.disorder_slug : null,
    variables: clampVariables(v as EmotionalVariables),
    mode: o.mode as EmotionMode,
    turn: typeof o.turn === "number" ? o.turn : 0,
    withdrawal_streak:
      typeof o.withdrawal_streak === "number" ? o.withdrawal_streak : 0,
    alliance_streak:
      typeof o.alliance_streak === "number" ? o.alliance_streak : 0,
    history: Array.isArray(o.history)
      ? (o.history as EmotionTransition[]).slice(-40)
      : [],
    created_at:
      typeof o.created_at === "string" ? o.created_at : new Date().toISOString(),
    updated_at:
      typeof o.updated_at === "string" ? o.updated_at : new Date().toISOString(),
  };
}

/**
 * Humanization Layer — presentation-only micro-behaviours.
 *
 * Owns: hesitations, pauses, fillers, false starts, emotional timing cues,
 * natural speech cadence for TTS/prompt delivery.
 *
 * Does NOT own: personality, emotional state, durable memory, adaptation,
 * or conversation behaviour decisions (those engines inject separately).
 */

import { createRng } from "@/lib/case-engine/generator";
import { isHumanizationEnabledForSession } from "@/lib/humanization/config";
import { HUMANIZATION_CATALOG } from "@/lib/humanization/catalog";
import { applyClinicalGates } from "@/lib/humanization/clinical-gates";
import { classifyTherapistMove } from "@/lib/humanization/classify-move";
import { behaviorTick } from "@/lib/humanization/engines/behavior";
import { emotionTick } from "@/lib/humanization/engines/emotion";
import { memoryTick } from "@/lib/humanization/engines/memory";
import { voiceTick } from "@/lib/humanization/engines/voice";
import {
  formatHumanizationPerTurnCue,
  formatHumanizationPromptCue,
  nonverbalCuesFor,
} from "@/lib/humanization/format";
import { HUMANIZATION_SCHEMA_VERSION } from "@/lib/humanization/types";
import type {
  HumanizationBehaviorId,
  HumanizationClientHints,
  HumanizationTurnInput,
  HumanizationTurnPlan,
} from "@/lib/humanization/types";

function sessionPhase(
  elapsedSeconds: number,
  maxDurationSec: number,
): "opening" | "middle" | "closing" | "overtime" {
  if (elapsedSeconds < 0) elapsedSeconds = 0;
  if (elapsedSeconds > maxDurationSec) return "overtime";
  const ratio = maxDurationSec > 0 ? elapsedSeconds / maxDurationSec : 0;
  if (ratio < 0.12) return "opening";
  if (ratio > 0.85) return "closing";
  return "middle";
}

function fatigueFromElapsed(
  elapsedSeconds: number,
  maxDurationSec: number,
  energy: string,
): number {
  const ratio = maxDurationSec > 0 ? elapsedSeconds / maxDurationSec : 0;
  let fatigue = ratio * 0.7;
  if (energy === "low") fatigue += 0.15;
  // Prefer Mission 2 fatigue when available (presentation timing only).
  return Math.max(0, Math.min(1, fatigue));
}

/**
 * Weighted sample without replacement.
 */
function pickBehaviors(
  allowed: HumanizationBehaviorId[],
  rng: () => number,
  count: number,
  category: string,
): HumanizationBehaviorId[] {
  const pool = allowed.map((id) => {
    const def = HUMANIZATION_CATALOG[id];
    let w = def.base_weight;
    if (def.preferred_categories.includes(category)) w *= 1.4;
    if (def.preferred_categories.includes("general")) w *= 1.05;
    return { id, w };
  });

  const picked: HumanizationBehaviorId[] = [];
  const target = Math.min(count, pool.length);
  for (let i = 0; i < target; i++) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    if (total <= 0) break;
    let r = rng() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j]!.w;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    const chosen = pool.splice(idx, 1)[0]!;
    picked.push(chosen.id);
  }
  return picked;
}

function behaviorsPerTurn(rng: () => number, intensity: number): number {
  let n = 2 + (rng() > 0.55 ? 1 : 0);
  if (intensity >= 8 && rng() > 0.4) n += 1;
  return Math.min(4, n);
}

/**
 * Build a presentation-only Humanization Turn Plan, or null when disabled.
 */
export function buildHumanizationTurn(
  input: HumanizationTurnInput,
): HumanizationTurnPlan | null {
  const enabled = isHumanizationEnabledForSession({
    hasClinicalSnapshot: Boolean(input.caseSnapshot),
  });
  if (!enabled) return null;

  const therapistMove = classifyTherapistMove(input.userMessage);
  const phase = sessionPhase(input.elapsedSeconds, input.maxDurationSec);
  const turnIndex = input.history.filter((m) => m.role === "user").length;

  const externalFatigue =
    typeof input.externalEmotion?.variables?.fatigue === "number"
      ? input.externalEmotion.variables.fatigue / 100
      : null;

  const provisionalFatigue =
    externalFatigue ??
    fatigueFromElapsed(input.elapsedSeconds, input.maxDurationSec, "moderate");

  // Map Mission 2 affect for gating; never invent clinical emotion.
  const emotion = emotionTick({
    snapshot: input.caseSnapshot,
    clinicalCore: input.clinicalCore,
    fatigue: provisionalFatigue,
    external: input.externalEmotion ?? null,
  });

  const behavior = behaviorTick({
    snapshot: input.caseSnapshot,
    clinicalCore: input.clinicalCore,
    emotion,
    fatigue: provisionalFatigue,
  });

  const fatigue =
    externalFatigue ??
    fatigueFromElapsed(
      input.elapsedSeconds,
      input.maxDurationSec,
      behavior.speech_energy,
    );

  // Flag only — Patient Memory owns facts.
  const hasPrior =
    input.hasPriorSessionMemory === true ||
    // Legacy test path: caseMemory presence treated as prior-session flag only.
    Boolean(
      input.caseMemory &&
        ((input.caseMemory.humanization as { prior_session_notes?: unknown })
          ?.prior_session_notes ||
          (input.caseMemory.hce as { episodic?: unknown })?.episodic),
    );

  const memory = memoryTick({
    hasPriorSessionMemory: hasPrior,
  });

  const gates = applyClinicalGates({
    snapshot: input.caseSnapshot,
    clinicalCore: input.clinicalCore,
    therapistMove,
    affect: emotion.primary,
    intensity: emotion.intensity,
    sessionPhase: phase,
    hasPriorSessionMemory: hasPrior,
    turnIndex,
  });

  const seed =
    input.seed ??
    `${input.sessionId}:${turnIndex}:${input.userMessage.slice(0, 48)}`;
  const rng = createRng(seed);
  const count = behaviorsPerTurn(rng, emotion.intensity);
  let selected = pickBehaviors(
    gates.allowed,
    rng,
    count,
    behavior.category,
  );

  // Guarantee at least one core human tell when possible.
  const corePrefer: HumanizationBehaviorId[] = [
    "hesitation",
    "filler_words",
    "uncertainty",
    "thinking_pause",
  ];
  if (selected.length === 0) {
    selected = corePrefer.filter((id) => gates.allowed.includes(id)).slice(0, 2);
  } else if (!selected.some((id) => corePrefer.includes(id))) {
    const boost = corePrefer.find((id) => gates.allowed.includes(id));
    if (boost && selected.length < 4) selected = [...selected, boost];
  }

  const voice = voiceTick({
    emotion,
    behavior,
    selected,
    fatigue,
  });

  // Prefer Mission 2 hesitation when available (presentation timing).
  if (
    typeof input.externalEmotion?.hesitation_ms === "number" &&
    input.externalEmotion.hesitation_ms > voice.pause_before_ms
  ) {
    voice.pause_before_ms = Math.round(input.externalEmotion.hesitation_ms);
  }

  const nonverbal_cues = nonverbalCuesFor(selected, input.sessionLanguage);
  const plan: HumanizationTurnPlan = {
    schema_version: HUMANIZATION_SCHEMA_VERSION,
    enabled: true,
    therapist_move: therapistMove,
    behaviors: selected,
    prompt_cue: "",
    per_turn_cue: "",
    nonverbal_cues,
    emotion,
    behavior,
    memory,
    voice,
    clinical_blocked: gates.blocked,
  };
  plan.prompt_cue = formatHumanizationPromptCue(plan, input.sessionLanguage);
  plan.per_turn_cue = formatHumanizationPerTurnCue(plan, input.sessionLanguage);
  return plan;
}

export function toClientHints(
  plan: HumanizationTurnPlan,
): HumanizationClientHints {
  return {
    enabled: true,
    behaviors: plan.behaviors,
    nonverbal: plan.nonverbal_cues,
    voiceHints: {
      pause_before_ms: plan.voice.pause_before_ms,
      speech_rate: plan.voice.speech_rate,
      stability: plan.voice.stability,
      style: plan.voice.style,
      speech_pace: plan.behavior.speech_pace,
      speech_energy: plan.behavior.speech_energy,
    },
    affect: {
      primary: plan.emotion.primary,
      intensity: plan.emotion.intensity,
    },
  };
}

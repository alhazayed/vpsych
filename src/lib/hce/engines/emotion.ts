/**
 * Emotion Engine — dynamic affect from therapist moves and case triggers.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type {
  AffectPrimary,
  EmotionEngineOutput,
  GptTurnOutput,
  HceMemoryState,
  TherapistMove,
} from "@/lib/hce/types";

const TRIGGER_KEYWORDS: Record<string, { affect: AffectPrimary; delta: number }> = {
  grandmother: { affect: "sad", delta: 2 },
  grandma: { affect: "sad", delta: 2 },
  funeral: { affect: "sad", delta: 2 },
  artwork: { affect: "hopeful", delta: 1 },
  painting: { affect: "hopeful", delta: 1 },
  kind: { affect: "ashamed", delta: 1 },
  care: { affect: "ashamed", delta: 1 },
};

export function emotionTick(
  snapshot: CaseInstanceSnapshot,
  state: HceMemoryState,
  therapistMove: TherapistMove,
  userMessage: string,
): EmotionEngineOutput {
  let primary = state.emotion.primary;
  let intensity = state.emotion.intensity;
  const triggers_fired: string[] = [];
  const directives: string[] = [];

  const lower = userMessage.toLowerCase();
  for (const [kw, effect] of Object.entries(TRIGGER_KEYWORDS)) {
    if (lower.includes(kw)) {
      triggers_fired.push(kw);
      primary = effect.affect;
      intensity = clamp(intensity + effect.delta, 1, 10);
      directives.push(`trigger:${kw} → brief ${effect.affect}, then recover`);
    }
  }

  const moveDelta = moveToAffectDelta(therapistMove);
  intensity = clamp(intensity + moveDelta.intensity, 1, 10);
  if (moveDelta.primary) primary = moveDelta.primary;
  directives.push(...moveDelta.directives);

  const modifiers = snapshot.difficulty_modifiers;
  if (modifiers.masking === "high" || modifiers.masking === "very_high") {
    intensity = Math.min(intensity, 6);
    directives.push("mask distress; flat delivery unless trigger fired");
  }

  return {
    primary_affect: primary,
    intensity,
    congruence: state.emotion.congruence,
    triggers_fired,
    directives,
  };
}

function moveToAffectDelta(move: TherapistMove): {
  intensity: number;
  primary?: AffectPrimary;
  directives: string[];
} {
  switch (move) {
    case "reflection":
      return {
        intensity: 0,
        directives: ["allow brief authentic affect if trigger present"],
      };
    case "validation":
      return {
        intensity: -1,
        directives: ["slight warmth possible; shame if tearful"],
      };
    case "invalidation":
      return {
        intensity: 1,
        primary: "numb",
        directives: ["withdraw affect; polite flat tone"],
      };
    case "advice":
      return {
        intensity: 0,
        directives: ["comply verbally; internal disengagement"],
      };
    case "rupture_repair":
      return {
        intensity: -2,
        primary: "relieved",
        directives: ["surprised by repair; largest alliance jump"],
      };
    case "safety_check":
      return {
        intensity: 0,
        directives: ["even delivery unless safety done well"],
      };
    default:
      return { intensity: 0, directives: [] };
  }
}

export function applyEmotionDelta(
  state: HceMemoryState,
  delta: GptTurnOutput["emotion_delta"],
  emotionOutput: EmotionEngineOutput,
): HceMemoryState {
  const emotion = { ...state.emotion };
  if (delta?.primary) emotion.primary = delta.primary;
  if (delta?.intensity_delta) {
    emotion.intensity = clamp(
      emotion.intensity + delta.intensity_delta,
      1,
      10,
    );
  } else {
    emotion.primary = emotionOutput.primary_affect;
    emotion.intensity = emotionOutput.intensity;
  }
  return { ...state, emotion };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Emotion Engine — affect + percentage vector (Layer 2 + 12).
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type {
  AffectPrimary,
  EmotionEngineOutput,
  EmotionVector,
  GptTurnOutput,
  HceMemoryState,
  TherapistMove,
} from "@/lib/hce/types";

const TRIGGER_KEYWORDS: Record<
  string,
  { affect: AffectPrimary; delta: number; vector: Partial<EmotionVector> }
> = {
  grandmother: { affect: "sad", delta: 2, vector: { sadness: 25, fatigue: 10 } },
  grandma: { affect: "sad", delta: 2, vector: { sadness: 25 } },
  father: { affect: "sad", delta: 1, vector: { sadness: 15, anxiety: 10 } },
  funeral: { affect: "sad", delta: 2, vector: { sadness: 30 } },
  artwork: { affect: "hopeful", delta: 1, vector: { hope: 20, sadness: -10 } },
  painting: { affect: "hopeful", delta: 1, vector: { hope: 15 } },
  kind: { affect: "ashamed", delta: 1, vector: { anxiety: 15, sadness: 10 } },
  care: { affect: "ashamed", delta: 1, vector: { anxiety: 12 } },
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
  let vector = { ...state.emotion.vector };

  const lower = userMessage.toLowerCase();
  for (const [kw, effect] of Object.entries(TRIGGER_KEYWORDS)) {
    if (lower.includes(kw)) {
      triggers_fired.push(kw);
      primary = effect.affect;
      intensity = clamp(intensity + effect.delta, 1, 10);
      vector = applyVectorDelta(vector, effect.vector);
      directives.push(`trigger:${kw} → brief ${effect.affect}, then recover`);
    }
  }

  const moveDelta = moveToAffectDelta(therapistMove);
  intensity = clamp(intensity + moveDelta.intensity, 1, 10);
  if (moveDelta.primary) primary = moveDelta.primary;
  vector = applyVectorDelta(vector, moveDelta.vector);
  directives.push(...moveDelta.directives);

  const modifiers = snapshot.difficulty_modifiers;
  if (modifiers.masking === "high" || modifiers.masking === "very_high") {
    intensity = Math.min(intensity, 6);
    vector.anxiety = Math.min(vector.anxiety, 55);
    directives.push("mask distress; flat delivery unless trigger fired");
  }

  vector = normalizeVector(vector);

  return {
    primary_affect: primary,
    intensity,
    congruence: state.emotion.congruence,
    triggers_fired,
    directives,
    vector,
  };
}

function moveToAffectDelta(move: TherapistMove): {
  intensity: number;
  primary?: AffectPrimary;
  vector: Partial<EmotionVector>;
  directives: string[];
} {
  switch (move) {
    case "reflection":
      return {
        intensity: 0,
        vector: { hope: 5, anxiety: -5 },
        directives: ["allow brief authentic affect if trigger present"],
      };
    case "validation":
      return {
        intensity: -1,
        vector: { hope: 8, anxiety: -8, sadness: -5 },
        directives: ["slight warmth possible; shame if tearful"],
      };
    case "invalidation":
      return {
        intensity: 1,
        primary: "numb",
        vector: { anger: 10, hope: -15, anxiety: 5 },
        directives: ["withdraw affect; polite flat tone"],
      };
    case "advice":
      return {
        intensity: 0,
        vector: { anxiety: 8, hope: -5 },
        directives: ["comply verbally; internal disengagement"],
      };
    case "rupture_repair":
      return {
        intensity: -2,
        primary: "relieved",
        vector: { hope: 20, anxiety: -15, sadness: -10 },
        directives: ["surprised by repair; largest alliance jump"],
      };
    case "safety_check":
      return {
        intensity: 0,
        vector: { anxiety: 12 },
        directives: ["even delivery unless safety done well"],
      };
    default:
      return { intensity: 0, vector: {}, directives: [] };
  }
}

export function applyEmotionDelta(
  state: HceMemoryState,
  delta: GptTurnOutput["emotion_delta"],
  emotionOutput: EmotionEngineOutput,
): HceMemoryState {
  const emotion = { ...state.emotion, vector: { ...emotionOutput.vector } };
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

function applyVectorDelta(v: EmotionVector, d: Partial<EmotionVector>): EmotionVector {
  return normalizeVector({
    sadness: v.sadness + (d.sadness ?? 0),
    anxiety: v.anxiety + (d.anxiety ?? 0),
    anger: v.anger + (d.anger ?? 0),
    hope: v.hope + (d.hope ?? 0),
    fatigue: v.fatigue + (d.fatigue ?? 0),
  });
}

function normalizeVector(v: EmotionVector): EmotionVector {
  return {
    sadness: clamp(v.sadness, 0, 100),
    anxiety: clamp(v.anxiety, 0, 100),
    anger: clamp(v.anger, 0, 100),
    hope: clamp(v.hope, 0, 100),
    fatigue: clamp(v.fatigue, 0, 100),
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

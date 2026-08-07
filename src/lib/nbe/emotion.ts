/**
 * Emotion → dimensional snapshot for the Behavior Engine.
 * When a full Emotion Engine is present, pass its snapshot directly instead.
 */

import type { EmotionSnapshot } from "./types";
import { clamp01 } from "./seed";

const AFFECT_BASE: Record<
  string,
  Omit<EmotionSnapshot, "affect" | "intensity">
> = {
  depressed: {
    sadness: 0.78,
    anxiety: 0.25,
    anger: 0.15,
    hope: 0.2,
    fatigue: 0.7,
    shame: 0.45,
    activation: 0.25,
  },
  anxious: {
    sadness: 0.3,
    anxiety: 0.82,
    anger: 0.2,
    hope: 0.35,
    fatigue: 0.4,
    shame: 0.35,
    activation: 0.75,
  },
  tearful: {
    sadness: 0.85,
    anxiety: 0.4,
    anger: 0.1,
    hope: 0.25,
    fatigue: 0.5,
    shame: 0.4,
    activation: 0.45,
  },
  irritable: {
    sadness: 0.35,
    anxiety: 0.35,
    anger: 0.75,
    hope: 0.3,
    fatigue: 0.45,
    shame: 0.25,
    activation: 0.7,
  },
  euphoric: {
    sadness: 0.05,
    anxiety: 0.2,
    anger: 0.15,
    hope: 0.9,
    fatigue: 0.15,
    shame: 0.05,
    activation: 0.9,
  },
  guarded: {
    sadness: 0.35,
    anxiety: 0.5,
    anger: 0.3,
    hope: 0.3,
    fatigue: 0.4,
    shame: 0.4,
    activation: 0.45,
  },
  agitated: {
    sadness: 0.3,
    anxiety: 0.65,
    anger: 0.55,
    hope: 0.25,
    fatigue: 0.35,
    shame: 0.3,
    activation: 0.88,
  },
  flat: {
    sadness: 0.45,
    anxiety: 0.2,
    anger: 0.1,
    hope: 0.25,
    fatigue: 0.55,
    shame: 0.3,
    activation: 0.15,
  },
  labile: {
    sadness: 0.55,
    anxiety: 0.55,
    anger: 0.45,
    hope: 0.4,
    fatigue: 0.4,
    shame: 0.5,
    activation: 0.65,
  },
  neutral: {
    sadness: 0.25,
    anxiety: 0.25,
    anger: 0.15,
    hope: 0.5,
    fatigue: 0.3,
    shame: 0.2,
    activation: 0.4,
  },
};

/** Disorder slug soft bias when only a slug is known. */
export function affectFromDisorder(slug?: string | null): string {
  if (!slug) return "neutral";
  if (/mdd|depress/i.test(slug)) return "depressed";
  if (/mania|bipolar/i.test(slug)) return "euphoric";
  if (/gad|anxiety|panic/i.test(slug)) return "anxious";
  if (/ptsd|trauma/i.test(slug)) return "guarded";
  if (/bpd|borderline/i.test(slug)) return "labile";
  if (/schizo|psychos/i.test(slug)) return "flat";
  if (/adhd|attention/i.test(slug)) return "neutral";
  if (/delirium/i.test(slug)) return "agitated";
  if (/alcohol|substance/i.test(slug)) return "guarded";
  return "neutral";
}

export function emotionFromAffect(
  affect: string,
  intensity = 0.55,
  overrides?: Partial<EmotionSnapshot>,
): EmotionSnapshot {
  const key = (overrides?.affect ?? affect).toLowerCase();
  const base = AFFECT_BASE[key] ?? AFFECT_BASE.neutral!;
  const i = clamp01(overrides?.intensity ?? intensity);
  const { affect: _a, intensity: _i, ...dimOverrides } = overrides ?? {};
  return {
    affect: key,
    intensity: i,
    sadness: scale(base.sadness, i),
    anxiety: scale(base.anxiety, i),
    anger: scale(base.anger, i),
    hope: scale(base.hope, i),
    fatigue: scale(base.fatigue, i),
    shame: scale(base.shame, i),
    activation: scale(base.activation, i),
    ...dimOverrides,
  };
}

function scale(v: number | undefined, intensity: number): number {
  const base = v ?? 0.3;
  // Pull toward mid when intensity is low; amplify when high
  return clamp01(0.15 + base * (0.5 + intensity * 0.5));
}

export function resolveEmotionInput(params: {
  emotion?: EmotionSnapshot | null;
  affect?: string | null;
  disorderSlug?: string | null;
  intensity?: number;
}): EmotionSnapshot {
  if (params.emotion) {
    return {
      ...params.emotion,
      intensity: clamp01(params.emotion.intensity),
      affect: params.emotion.affect.toLowerCase(),
    };
  }
  const affect =
    params.affect?.toLowerCase() ||
    affectFromDisorder(params.disorderSlug) ||
    "neutral";
  return emotionFromAffect(affect, params.intensity ?? 0.55);
}

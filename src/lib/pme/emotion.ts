/**
 * Module 4 — Emotional state machine. Gradual change only.
 */

import type { EmotionalState } from "@/lib/pme/types";

export function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

/** Blend toward target with inertia (emotions persist). */
export function nudgeEmotion(
  current: EmotionalState,
  delta: Partial<EmotionalState>,
  inertia = 0.35,
): EmotionalState {
  const next = { ...current };
  for (const key of Object.keys(delta) as (keyof EmotionalState)[]) {
    const d = delta[key];
    if (typeof d !== "number") continue;
    const cur = current[key];
    // Apply only a fraction of the requested delta each turn
    next[key] = clamp01to100(cur + d * inertia);
  }
  // Soft mean-reversion toward baseline_mood for activation spikes
  next.activation = clamp01to100(
    next.activation * 0.92 + current.baseline_mood * 0.02,
  );
  return next;
}

export function emotionSummary(e: EmotionalState): string {
  const parts: string[] = [];
  if (e.helplessness >= 60) parts.push("helpless");
  if (e.hope <= 35) parts.push("low hope");
  if (e.fear >= 55) parts.push("fearful");
  if (e.anger >= 55) parts.push("irritable/angry");
  if (e.shame >= 55) parts.push("ashamed");
  if (e.guilt >= 55) parts.push("guilty");
  if (e.fatigue >= 60) parts.push("fatigued");
  if (e.trust <= 35) parts.push("distrustful");
  if (e.activation >= 70) parts.push("activated");
  if (e.baseline_mood <= 35) parts.push("low mood baseline");
  if (e.baseline_mood >= 70) parts.push("elevated mood baseline");
  if (!parts.length) parts.push("guarded-neutral");
  return parts.join(", ");
}

export function baselineForDisorder(slug: string): EmotionalState {
  if (/mania|bipolar/i.test(slug)) {
    return {
      baseline_mood: 72,
      activation: 70,
      fatigue: 25,
      hope: 75,
      fear: 30,
      anger: 40,
      trust: 45,
      shame: 20,
      guilt: 25,
      helplessness: 20,
    };
  }
  if (/schizo/i.test(slug)) {
    return {
      baseline_mood: 40,
      activation: 35,
      fatigue: 55,
      hope: 30,
      fear: 55,
      anger: 30,
      trust: 25,
      shame: 40,
      guilt: 35,
      helplessness: 50,
    };
  }
  if (/ptsd|trauma/i.test(slug)) {
    return {
      baseline_mood: 38,
      activation: 55,
      fatigue: 50,
      hope: 35,
      fear: 65,
      anger: 40,
      trust: 30,
      shame: 55,
      guilt: 60,
      helplessness: 45,
    };
  }
  if (/ocd/i.test(slug)) {
    return {
      baseline_mood: 42,
      activation: 60,
      fatigue: 45,
      hope: 40,
      fear: 60,
      anger: 25,
      trust: 45,
      shame: 50,
      guilt: 55,
      helplessness: 40,
    };
  }
  if (/bpd|borderline/i.test(slug)) {
    return {
      baseline_mood: 45,
      activation: 55,
      fatigue: 40,
      hope: 40,
      fear: 55,
      anger: 50,
      trust: 35,
      shame: 55,
      guilt: 45,
      helplessness: 50,
    };
  }
  // Default MDD / general
  return {
    baseline_mood: 30,
    activation: 25,
    fatigue: 65,
    hope: 25,
    fear: 40,
    anger: 25,
    trust: 40,
    shame: 45,
    guilt: 50,
    helplessness: 60,
  };
}

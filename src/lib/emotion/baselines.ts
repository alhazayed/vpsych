/**
 * Disorder → baseline emotional priors (Mission 2).
 * Locale never changes diagnosis; baselines are clinical priors only.
 */

import type { EmotionalVariables } from "@/lib/emotion/types";

function vars(partial: EmotionalVariables): EmotionalVariables {
  return { ...partial };
}

/** Default MDD-leaning baseline when disorder is unknown. */
export const DEFAULT_BASELINE: EmotionalVariables = vars({
  baseline_mood: 32,
  current_mood: 30,
  stress: 55,
  fear: 40,
  anger: 25,
  hope: 28,
  trust: 42,
  rapport: 35,
  fatigue: 62,
  motivation: 38,
});

/**
 * Map disorder slug → initial emotional variables.
 * current_mood starts near baseline_mood; trust/rapport start modest.
 */
export function baselineForDisorder(
  slug: string | null | undefined,
): EmotionalVariables {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s) return { ...DEFAULT_BASELINE };

  if (/mania|hypomania|bipolar.*man/i.test(s) || s.includes("mania")) {
    return vars({
      baseline_mood: 72,
      current_mood: 70,
      stress: 45,
      fear: 28,
      anger: 42,
      hope: 74,
      trust: 48,
      rapport: 40,
      fatigue: 28,
      motivation: 65,
    });
  }

  if (/bipolar/i.test(s)) {
    return vars({
      baseline_mood: 48,
      current_mood: 45,
      stress: 50,
      fear: 38,
      anger: 35,
      hope: 45,
      trust: 42,
      rapport: 38,
      fatigue: 48,
      motivation: 42,
    });
  }

  if (/schizo/i.test(s)) {
    return vars({
      baseline_mood: 38,
      current_mood: 36,
      stress: 58,
      fear: 62,
      anger: 30,
      hope: 28,
      trust: 22,
      rapport: 20,
      fatigue: 55,
      motivation: 30,
    });
  }

  if (/ptsd|trauma|cptsd/i.test(s)) {
    return vars({
      baseline_mood: 36,
      current_mood: 34,
      stress: 68,
      fear: 72,
      anger: 42,
      hope: 32,
      trust: 28,
      rapport: 25,
      fatigue: 55,
      motivation: 35,
    });
  }

  if (/panic|gad|anxiety|social.?anx/i.test(s)) {
    return vars({
      baseline_mood: 42,
      current_mood: 40,
      stress: 72,
      fear: 68,
      anger: 28,
      hope: 40,
      trust: 45,
      rapport: 38,
      fatigue: 48,
      motivation: 42,
    });
  }

  if (/ocd/i.test(s)) {
    return vars({
      baseline_mood: 40,
      current_mood: 38,
      stress: 70,
      fear: 65,
      anger: 28,
      hope: 38,
      trust: 44,
      rapport: 36,
      fatigue: 50,
      motivation: 40,
    });
  }

  if (/bpd|borderline/i.test(s)) {
    return vars({
      baseline_mood: 44,
      current_mood: 42,
      stress: 60,
      fear: 58,
      anger: 52,
      hope: 38,
      trust: 32,
      rapport: 30,
      fatigue: 42,
      motivation: 40,
    });
  }

  if (/delirium|neurocog/i.test(s)) {
    return vars({
      baseline_mood: 40,
      current_mood: 38,
      stress: 50,
      fear: 45,
      anger: 25,
      hope: 35,
      trust: 40,
      rapport: 35,
      fatigue: 70,
      motivation: 25,
    });
  }

  if (/eating|anorex|bulim/i.test(s)) {
    return vars({
      baseline_mood: 35,
      current_mood: 33,
      stress: 58,
      fear: 50,
      anger: 30,
      hope: 30,
      trust: 35,
      rapport: 32,
      fatigue: 55,
      motivation: 32,
    });
  }

  // MDD / dysthymia / default mood disorders
  if (/mdd|depress|dysthym|pdd|mood/i.test(s)) {
    return { ...DEFAULT_BASELINE };
  }

  return { ...DEFAULT_BASELINE };
}

/**
 * Emotional inertia (0–1): fraction of requested delta applied per turn.
 * Higher = slower change (depression marker).
 */
export function inertiaForDisorder(slug: string | null | undefined): number {
  const s = (slug ?? "").trim().toLowerCase();
  if (/mania|hypomania/i.test(s)) return 0.55;
  if (/bpd|borderline/i.test(s)) return 0.5;
  if (/mdd|depress|dysthym|pdd/i.test(s)) return 0.28;
  if (/ptsd|trauma/i.test(s)) return 0.38;
  if (/schizo/i.test(s)) return 0.32;
  return 0.35;
}

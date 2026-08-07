/**
 * Emotion → clinical voice deltas.
 *
 * Depressed  → slow, low energy
 * Anxious    → faster, short breaths
 * Manic      → pressured speech
 * Psychotic  → inappropriate pauses
 */

import type {
  ClinicalEmotion,
  EmotionModulationDelta,
} from "./types";

export const CLINICAL_EMOTIONS: readonly ClinicalEmotion[] = [
  "neutral",
  "depressed",
  "anxious",
  "manic",
  "psychotic",
] as const;

const DELTAS: Record<ClinicalEmotion, EmotionModulationDelta> = {
  neutral: {
    speech_rate_mul: 1,
    pitch_mul: 1,
    hesitation_delta: 0,
    speaker_boost_delta: 0,
    pause_scale: 1,
    stability_nudge: 0,
    style_nudge: 0,
    summary: "Baseline clinical delivery; no affect overlay.",
  },
  depressed: {
    speech_rate_mul: 0.78,
    pitch_mul: 0.88,
    energy: "low",
    prosody: "flat",
    breathing: "deep",
    hesitation_delta: 0.22,
    speaker_boost_delta: -0.04,
    pause_scale: 1.35,
    stability_nudge: 0.18,
    style_nudge: -0.12,
    summary: "Depressed: slowed rate, low energy, longer pauses, flat prosody.",
  },
  anxious: {
    speech_rate_mul: 1.14,
    pitch_mul: 1.08,
    energy: "high",
    prosody: "anxious_edge",
    breathing: "short",
    hesitation_delta: 0.12,
    speaker_boost_delta: 0.02,
    pause_scale: 0.85,
    stability_nudge: -0.1,
    style_nudge: 0.12,
    summary: "Anxious: faster speech, short breaths, edged prosody.",
  },
  manic: {
    speech_rate_mul: 1.28,
    pitch_mul: 1.12,
    energy: "high",
    prosody: "pressured",
    breathing: "short",
    hesitation_delta: -0.15,
    speaker_boost_delta: 0.04,
    pause_scale: 0.7,
    stability_nudge: -0.18,
    style_nudge: 0.22,
    summary: "Manic: pressured speech, elevated pitch/energy, reduced hesitations.",
  },
  psychotic: {
    speech_rate_mul: 0.95,
    pitch_mul: 0.98,
    energy: "labile",
    prosody: "fragmented",
    breathing: "irregular",
    hesitation_delta: 0.18,
    speaker_boost_delta: -0.02,
    pause_scale: 1.55,
    stability_nudge: -0.08,
    style_nudge: 0.08,
    summary:
      "Psychotic: inappropriate pauses, fragmented prosody, irregular breathing.",
  },
};

export function normalizeClinicalEmotion(
  raw?: string | null,
): ClinicalEmotion | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (
    v === "neutral" ||
    v === "depressed" ||
    v === "anxious" ||
    v === "manic" ||
    v === "psychotic"
  ) {
    return v;
  }
  // Common aliases from case/affect vocabularies.
  if (v === "depression" || v === "low" || v === "sad") return "depressed";
  if (v === "anxiety" || v === "panic" || v === "worried") return "anxious";
  if (v === "mania" || v === "elevated" || v === "pressured") return "manic";
  if (v === "psychosis" || v === "disorganized" || v === "paranoid") {
    return "psychotic";
  }
  return null;
}

export function emotionModulationFor(
  emotion: ClinicalEmotion,
): EmotionModulationDelta {
  return DELTAS[emotion];
}

/**
 * Infer clinical emotion band from a disorder slug when the client
 * does not send an explicit emotion.
 */
export function emotionFromDisorderSlug(
  slug?: string | null,
): ClinicalEmotion {
  if (!slug) return "neutral";
  const s = slug.trim().toLowerCase();
  if (!s || s.length > 64 || !/^[a-z0-9-]+$/i.test(s)) return "neutral";
  if (/mdd|depress/i.test(s)) return "depressed";
  if (/mania|bipolar/i.test(s)) return "manic";
  if (/schizo|psychos|delirium/i.test(s)) return "psychotic";
  if (/gad|panic|anxiety|ptsd|trauma/i.test(s)) return "anxious";
  if (/bpd|borderline|adhd/i.test(s)) return "anxious";
  return "neutral";
}

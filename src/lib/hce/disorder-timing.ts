/**
 * Disorder-specific conversation timing profiles (Layer 1).
 * Trainees subconsciously register response latency as realism signal.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";

export type DisorderTimingProfile = {
  /** Base delay before patient begins speaking (ms). */
  response_latency_ms: number;
  /** Random variance ± ms applied per turn. */
  latency_variance_ms: number;
  /** Extra delay after emotional trigger (PTSD, grief). */
  trigger_delay_ms: number;
  /** 0–1 probability patient interrupts mid-therapist turn (mania, BPD). */
  interrupt_probability: number;
  /** Speech rate multiplier hint for TTS (0.5 = slow, 1.5 = fast). */
  speech_rate: number;
  /** Irregular timing jitter factor 0–1 (psychosis). */
  irregularity: number;
};

const DEFAULT_TIMING: DisorderTimingProfile = {
  response_latency_ms: 800,
  latency_variance_ms: 400,
  trigger_delay_ms: 0,
  interrupt_probability: 0.05,
  speech_rate: 1,
  irregularity: 0.1,
};

const BY_SLUG: Record<string, Partial<DisorderTimingProfile>> = {
  mdd: {
    response_latency_ms: 2200,
    latency_variance_ms: 900,
    trigger_delay_ms: 400,
    speech_rate: 0.82,
    irregularity: 0.05,
  },
  major_depressive_disorder: {
    response_latency_ms: 2200,
    latency_variance_ms: 900,
    speech_rate: 0.82,
  },
  gad: {
    response_latency_ms: 600,
    latency_variance_ms: 500,
    speech_rate: 1.08,
    irregularity: 0.15,
  },
  generalized_anxiety_disorder: {
    response_latency_ms: 600,
    latency_variance_ms: 500,
    speech_rate: 1.08,
  },
  ocd: {
    response_latency_ms: 1400,
    latency_variance_ms: 300,
    speech_rate: 0.95,
    irregularity: 0.08,
  },
  ptsd: {
    response_latency_ms: 1200,
    latency_variance_ms: 700,
    trigger_delay_ms: 1800,
    speech_rate: 0.9,
    irregularity: 0.2,
  },
  bipolar_mania: {
    response_latency_ms: 200,
    latency_variance_ms: 150,
    interrupt_probability: 0.35,
    speech_rate: 1.35,
    irregularity: 0.25,
  },
  mania: {
    response_latency_ms: 200,
    latency_variance_ms: 150,
    interrupt_probability: 0.35,
    speech_rate: 1.35,
  },
  schizophrenia: {
    response_latency_ms: 1500,
    latency_variance_ms: 1200,
    speech_rate: 0.88,
    irregularity: 0.45,
  },
  psychosis: {
    response_latency_ms: 1500,
    latency_variance_ms: 1200,
    irregularity: 0.45,
  },
  borderline: {
    response_latency_ms: 700,
    latency_variance_ms: 600,
    interrupt_probability: 0.22,
    speech_rate: 1.1,
    irregularity: 0.3,
  },
  bpd: {
    response_latency_ms: 700,
    latency_variance_ms: 600,
    interrupt_probability: 0.22,
    speech_rate: 1.1,
    irregularity: 0.3,
  },
  autism: {
    response_latency_ms: 2800,
    latency_variance_ms: 800,
    speech_rate: 0.85,
    irregularity: 0.12,
  },
  asd: {
    response_latency_ms: 2800,
    latency_variance_ms: 800,
    speech_rate: 0.85,
  },
};

function slugKeys(slug: string): string[] {
  const s = slug.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const keys = [s];
  if (s.includes("depress")) keys.push("mdd");
  if (s.includes("anxiety") && s.includes("general")) keys.push("gad");
  if (s.includes("mania") || s.includes("bipolar")) keys.push("bipolar_mania");
  if (s.includes("ptsd") || s.includes("trauma")) keys.push("ptsd");
  if (s.includes("ocd") || s.includes("obsessive")) keys.push("ocd");
  if (s.includes("schizo") || s.includes("psychotic")) keys.push("schizophrenia");
  if (s.includes("borderline")) keys.push("borderline");
  return keys;
}

export function resolveDisorderTiming(
  snapshot: CaseInstanceSnapshot,
): DisorderTimingProfile {
  const slug = snapshot.primary_diagnosis.slug;
  const keys = slugKeys(slug);
  let merged = { ...DEFAULT_TIMING };

  for (const key of keys) {
    const partial = BY_SLUG[key];
    if (partial) merged = { ...merged, ...partial };
  }

  const masking = snapshot.difficulty_modifiers.masking;
  if (masking === "high" || masking === "very_high") {
    merged.response_latency_ms += 400;
    merged.speech_rate *= 0.92;
  }

  return merged;
}

export function computeTurnTiming(
  profile: DisorderTimingProfile,
  triggerDelay: boolean,
  seed: number,
): {
  pause_before_ms: number;
  speech_rate: number;
  should_interrupt: boolean;
} {
  const jitter =
    (pseudoRandom(seed) - 0.5) * 2 * profile.latency_variance_ms;
  const irregular =
    profile.irregularity > 0
      ? pseudoRandom(seed + 1) * profile.irregularity * 1500
      : 0;
  let pause =
    profile.response_latency_ms + jitter + irregular;
  if (triggerDelay) pause += profile.trigger_delay_ms;
  pause = Math.max(150, Math.min(6000, Math.round(pause)));

  const should_interrupt =
    pseudoRandom(seed + 2) < profile.interrupt_probability;

  return {
    pause_before_ms: pause,
    speech_rate: profile.speech_rate,
    should_interrupt,
  };
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

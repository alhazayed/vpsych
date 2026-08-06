import { derivePatientBehavior, deterministicJitter } from "./pme-bridge";

/**
 * Clinically gated patient interruption of the therapist.
 * Only certain presentations interrupt, and only when probability + turn seed agree.
 */
export function shouldPatientInterruptTherapist(params: {
  disorderSlug?: string | null;
  /** Therapist continuous speech duration so far (ms). */
  therapistSpeechMs: number;
  seed: string;
  /** Minimum therapist speech before interruption is considered. */
  minSpeechMs?: number;
}): boolean {
  const behavior = derivePatientBehavior({
    disorderSlug: params.disorderSlug,
    phase: "listening",
    seed: params.seed,
  });

  if (!behavior.mayInterruptTherapist) return false;

  const minMs = params.minSpeechMs ?? 3500;
  if (params.therapistSpeechMs < minMs) return false;

  // Deterministic roll from seed — not Math.random.
  const roll = deterministicJitter(`${params.seed}:interrupt`, 1000) / 1000;
  return roll < behavior.interruptProbability;
}

/**
 * Disorders that may interrupt — documented for UI / docs; logic lives in PME bridge.
 */
export const INTERRUPTIVE_DISORDER_HINTS = [
  "mania / bipolar",
  "borderline personality disorder",
  "high anxiety / panic",
  "PTSD (hyperarousal)",
  "agitation / delirium",
  "adult ADHD",
] as const;

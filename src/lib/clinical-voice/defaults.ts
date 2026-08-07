import type {
  ClinicalBreathing,
  ClinicalEnergy,
  ClinicalProsody,
  ClinicalVoiceParams,
} from "./types";

/** Baseline clinical params when a registry row has no clinical columns yet. */
export const DEFAULT_CLINICAL_VOICE_PARAMS: ClinicalVoiceParams = {
  speech_rate: 1,
  pitch: 1,
  energy: "moderate",
  prosody: "measured",
  breathing: "calm",
  hesitation_frequency: 0.18,
  speaker_boost: 0.75,
  emotion_modulation: true,
  pronunciation_ar: null,
  pronunciation_en: null,
};

export function isClinicalEnergy(v: unknown): v is ClinicalEnergy {
  return (
    v === "low" || v === "moderate" || v === "high" || v === "labile"
  );
}

export function isClinicalProsody(v: unknown): v is ClinicalProsody {
  return (
    v === "flat" ||
    v === "measured" ||
    v === "anxious_edge" ||
    v === "pressured" ||
    v === "fragmented" ||
    v === "labile"
  );
}

export function isClinicalBreathing(v: unknown): v is ClinicalBreathing {
  return (
    v === "calm" ||
    v === "short" ||
    v === "deep" ||
    v === "irregular" ||
    v === "held"
  );
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function clampRate(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1.8, Math.max(0.5, n));
}

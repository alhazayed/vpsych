/**
 * CB-HCF-007 — map clinical speech phenotype → ElevenLabs voice_settings.
 * Not a full emotion director (HCE deferred). Bounded presets only so
 * consultants hear slowed depression / pressured mania / anxious edge
 * instead of one flat voice for every diagnosis.
 */

import type { SpeechBehaviorProfile } from "@/lib/case-engine/speech-behavior";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";

export type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style?: number;
  /**
   * Confirmed field of the ElevenLabs `VoiceSettings` object (no model
   * restriction documented). Boosts similarity to the source speaker.
   */
  use_speaker_boost?: boolean;
  /**
   * Confirmed field of the ElevenLabs `VoiceSettings` object: 1.0 is default,
   * <1 slower, >1 faster. This is how the Clinical Voice Profile `speech_rate`
   * finally reaches the provider — previously it was computed and discarded.
   */
  speed?: number;
};

/** ElevenLabs rejects values outside this band; clamp before sending. */
export const SPEED_BOUNDS = { min: 0.7, max: 1.2 } as const;

export function clampSpeed(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(SPEED_BOUNDS.min, Math.min(SPEED_BOUNDS.max, value));
}

export type SpeechPace =
  | "slow"
  | "measured"
  | "fast"
  | "variable"
  | "pressured";

export type SpeechEnergy = "low" | "moderate" | "high" | "labile";

const DEFAULT_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.4,
  similarity_boost: 0.75,
};

/**
 * Clamp attacker-controlled optional fields to known pace/energy enums.
 */
export function normalizeSpeechPace(raw?: string | null): SpeechPace | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (
    v === "slow" ||
    v === "measured" ||
    v === "fast" ||
    v === "variable" ||
    v === "pressured"
  ) {
    return v;
  }
  return null;
}

export function normalizeSpeechEnergy(raw?: string | null): SpeechEnergy | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "low" || v === "moderate" || v === "high" || v === "labile") {
    return v;
  }
  return null;
}

export function voiceSettingsForPaceEnergy(
  pace: SpeechPace | null | undefined,
  energy: SpeechEnergy | null | undefined,
): ElevenLabsVoiceSettings {
  const p = pace ?? "measured";
  const e = energy ?? "moderate";

  // Stability: lower = more expressive/variable delivery; higher = flatter/steadier.
  // similarity_boost stays mostly stable so casting identity holds.
  // speed carries the clinical pace that used to be dropped at the API edge.
  if (p === "slow" || e === "low") {
    return { stability: 0.62, similarity_boost: 0.72, style: 0.15, speed: 0.9 };
  }
  if (p === "pressured" || (p === "fast" && e === "high")) {
    return { stability: 0.28, similarity_boost: 0.7, style: 0.45, speed: 1.12 };
  }
  if (p === "fast" || e === "high") {
    return { stability: 0.32, similarity_boost: 0.72, style: 0.35, speed: 1.06 };
  }
  if (p === "variable" || e === "labile") {
    return { stability: 0.3, similarity_boost: 0.7, style: 0.4, speed: 1.02 };
  }
  return { ...DEFAULT_SETTINGS, style: 0.25 };
}

export function voiceSettingsForSpeechProfile(
  profile: Pick<SpeechBehaviorProfile, "pace" | "energy">,
): ElevenLabsVoiceSettings {
  return voiceSettingsForPaceEnergy(profile.pace, profile.energy);
}

/**
 * Resolve prosody from optional client hints and/or disorder slug.
 * Explicit pace/energy win; else disorder speech profile; else defaults.
 */
export function resolveVoiceSettings(params: {
  speechPace?: string | null;
  speechEnergy?: string | null;
  disorderSlug?: string | null;
}): ElevenLabsVoiceSettings {
  const pace = normalizeSpeechPace(params.speechPace);
  const energy = normalizeSpeechEnergy(params.speechEnergy);
  if (pace || energy) {
    return voiceSettingsForPaceEnergy(pace, energy);
  }
  const slug = params.disorderSlug?.trim();
  if (slug) {
    // Bound length — slug is a hint, not free text for the model API.
    if (slug.length <= 64 && /^[a-z0-9-]+$/i.test(slug)) {
      return voiceSettingsForSpeechProfile(speechBehaviorForDisorder(slug));
    }
  }
  return { ...DEFAULT_SETTINGS };
}

/** Browser SpeechSynthesis rate hint (1.0 = default). */
export function browserSpeechRateForPace(pace?: SpeechPace | null): number {
  switch (pace) {
    case "slow":
      return 0.82;
    case "pressured":
      return 1.18;
    case "fast":
      return 1.1;
    case "variable":
      return 1.02;
    default:
      return 0.95;
  }
}

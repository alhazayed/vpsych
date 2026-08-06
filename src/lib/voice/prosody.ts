/**
 * CB-HCF-007 — map clinical speech phenotype → ElevenLabs voice_settings.
 * Tuned for standardized-patient realism: natural variation, speaker boost,
 * and bounded style — not flat assistant narration.
 */

import type { SpeechBehaviorProfile } from "@/lib/case-engine/speech-behavior";
import { speechBehaviorForDisorder } from "@/lib/case-engine/speech-behavior";

export type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
};

export type SpeechPace =
  | "slow"
  | "measured"
  | "fast"
  | "variable"
  | "pressured";

export type SpeechEnergy = "low" | "moderate" | "high" | "labile";

/**
 * Production defaults for psychiatric SP interviews.
 * - stability mid-low → natural micro-variation (avoids robotic flatness)
 * - similarity_boost high → keep casting identity
 * - style modest → character without cartoon exaggeration
 * - speaker boost on → clearer human timbre
 */
const DEFAULT_SETTINGS: ElevenLabsVoiceSettings = {
  stability: 0.38,
  similarity_boost: 0.82,
  style: 0.28,
  use_speaker_boost: true,
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

function withBoost(
  settings: Omit<ElevenLabsVoiceSettings, "use_speaker_boost">,
): ElevenLabsVoiceSettings {
  return { ...settings, use_speaker_boost: true };
}

export function voiceSettingsForPaceEnergy(
  pace: SpeechPace | null | undefined,
  energy: SpeechEnergy | null | undefined,
): ElevenLabsVoiceSettings {
  const p = pace ?? "measured";
  const e = energy ?? "moderate";

  // Stability: lower = more expressive/variable delivery; higher = steadier.
  // Keep stability below ~0.55 even for depression — too high sounds robotic.
  if (p === "slow" || e === "low") {
    return withBoost({
      stability: 0.48,
      similarity_boost: 0.8,
      style: 0.22,
    });
  }
  if (p === "pressured" || (p === "fast" && e === "high")) {
    return withBoost({
      stability: 0.26,
      similarity_boost: 0.78,
      style: 0.42,
    });
  }
  if (p === "fast" || e === "high") {
    return withBoost({
      stability: 0.3,
      similarity_boost: 0.8,
      style: 0.36,
    });
  }
  if (p === "variable" || e === "labile") {
    return withBoost({
      stability: 0.28,
      similarity_boost: 0.78,
      style: 0.38,
    });
  }
  return { ...DEFAULT_SETTINGS };
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

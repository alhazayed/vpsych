/**
 * Voice Profile Manager — resolve clinical params and live-switch by emotion.
 */

import {
  clamp01,
  clampRate,
  DEFAULT_CLINICAL_VOICE_PARAMS,
} from "./defaults";
import {
  emotionFromDisorderSlug,
  emotionModulationFor,
  normalizeClinicalEmotion,
} from "./emotion-modulation";
import { clinicalParamsFromRow } from "./validation";
import type {
  ClinicalEmotion,
  ClinicalVoiceParams,
  ClinicalVoiceProfile,
  EffectiveClinicalVoice,
  LiveSwitchRequest,
} from "./types";
import type { PreferredLanguage } from "@/lib/types";
import type { ElevenLabsVoiceSettings } from "@/lib/voice/prosody";
import {
  voiceSettingsForPaceEnergy,
  type SpeechEnergy,
  type SpeechPace,
} from "@/lib/voice/prosody";

function volumeForEnergy(energy: ClinicalVoiceParams["energy"]): number {
  switch (energy) {
    case "low":
      return 0.78;
    case "high":
      return 1;
    case "labile":
      return 0.9;
    default:
      return 0.92;
  }
}

function paceFromRate(rate: number): SpeechPace {
  if (rate < 0.85) return "slow";
  if (rate > 1.22) return "pressured";
  if (rate > 1.08) return "fast";
  return "measured";
}

function energyForSettings(
  energy: ClinicalVoiceParams["energy"],
): SpeechEnergy {
  return energy;
}

function baseStabilityStyle(
  params: ClinicalVoiceParams,
): ElevenLabsVoiceSettings {
  const pace = paceFromRate(params.speech_rate);
  const settings = voiceSettingsForPaceEnergy(
    pace,
    energyForSettings(params.energy),
  );
  return {
    stability: settings.stability,
    similarity_boost: clamp01(params.speaker_boost),
    style: settings.style ?? 0.25,
  };
}

/**
 * Apply emotion modulation on top of a baseline clinical profile.
 * When emotion_modulation is false, returns baseline with emotion label only.
 */
export function applyEmotionModulation(
  base: ClinicalVoiceParams,
  emotion: ClinicalEmotion,
): {
  params: ClinicalVoiceParams;
  pause_scale: number;
  stability_nudge: number;
  style_nudge: number;
  note: string;
} {
  if (!base.emotion_modulation || emotion === "neutral") {
    const delta = emotionModulationFor("neutral");
    return {
      params: { ...base },
      pause_scale: 1,
      stability_nudge: 0,
      style_nudge: 0,
      note: delta.summary,
    };
  }

  const delta = emotionModulationFor(emotion);
  const params: ClinicalVoiceParams = {
    ...base,
    speech_rate: clampRate(base.speech_rate * delta.speech_rate_mul),
    pitch: clampRate(base.pitch * delta.pitch_mul),
    energy: delta.energy ?? base.energy,
    prosody: delta.prosody ?? base.prosody,
    breathing: delta.breathing ?? base.breathing,
    hesitation_frequency: clamp01(
      base.hesitation_frequency + delta.hesitation_delta,
    ),
    speaker_boost: clamp01(base.speaker_boost + delta.speaker_boost_delta),
  };

  return {
    params,
    pause_scale: delta.pause_scale,
    stability_nudge: delta.stability_nudge,
    style_nudge: delta.style_nudge,
    note: delta.summary,
  };
}

/** Resolve the emotion to apply for a live switch request. */
export function resolveLiveEmotion(request: {
  emotion?: string | null;
  disorderSlug?: string | null;
}): ClinicalEmotion {
  return (
    normalizeClinicalEmotion(request.emotion) ??
    emotionFromDisorderSlug(request.disorderSlug) ??
    "neutral"
  );
}

/**
 * Live-switch: baseline profile + emotion → EffectiveClinicalVoice.
 * Voice ID is preserved; only clinical delivery parameters change.
 */
export function liveSwitchVoice(
  request: LiveSwitchRequest,
): EffectiveClinicalVoice {
  const emotion = resolveLiveEmotion({
    emotion: request.emotion,
    disorderSlug: request.disorderSlug,
  });
  const base = clinicalParamsFromRow(request.profile);
  const applied = applyEmotionModulation(base, emotion);
  const elevenBase = baseStabilityStyle(applied.params);
  const elevenlabs = {
    stability: clamp01(elevenBase.stability + applied.stability_nudge),
    similarity_boost: clamp01(applied.params.speaker_boost),
    style: clamp01((elevenBase.style ?? 0.25) + applied.style_nudge),
  };

  return {
    ...applied.params,
    emotion,
    pause_scale: applied.pause_scale,
    voice_id: request.profile.voice_id,
    voice_profile_id: request.profile.id,
    language: request.profile.language,
    elevenlabs,
    browser: {
      rate: applied.params.speech_rate,
      pitch: applied.params.pitch,
      volume: volumeForEnergy(applied.params.energy),
    },
    modulation_note: applied.note,
  };
}

/** Project a DB voice_profiles row into ClinicalVoiceProfile. */
export function toClinicalVoiceProfile(
  row: Record<string, unknown> & {
    id: string;
    provider: string;
    voice_name: string;
    voice_id: string;
    language: PreferredLanguage | (string & {});
    dialect?: string | null;
    gender?: string | null;
    is_active: boolean;
    created_at: string;
    updated_at?: string | null;
  },
): ClinicalVoiceProfile {
  const params = clinicalParamsFromRow(row as Partial<ClinicalVoiceParams>);
  return {
    id: row.id,
    provider: row.provider,
    voice_name: row.voice_name,
    voice_id: row.voice_id,
    language: row.language,
    dialect: row.dialect ?? null,
    gender: row.gender ?? null,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
    ...params,
  };
}

/**
 * Map effective clinical voice → ElevenLabs settings for the TTS service.
 * Prefer this over bare pace/energy when a clinical profile is present.
 */
export function elevenLabsSettingsFromEffective(
  effective: EffectiveClinicalVoice,
): ElevenLabsVoiceSettings {
  return {
    stability: effective.elevenlabs.stability,
    similarity_boost: effective.elevenlabs.similarity_boost,
    style: effective.elevenlabs.style,
  };
}

/** Columns admins may PATCH on a voice profile (clinical + is_active). */
export const CLINICAL_VOICE_PATCH_KEYS = [
  "is_active",
  "voice_name",
  "dialect",
  "gender",
  "speech_rate",
  "pitch",
  "energy",
  "prosody",
  "breathing",
  "hesitation_frequency",
  "speaker_boost",
  "emotion_modulation",
  "pronunciation_ar",
  "pronunciation_en",
] as const;

export type ClinicalVoicePatchKey = (typeof CLINICAL_VOICE_PATCH_KEYS)[number];

export function clinicalParamsPatchFromBody(
  body: Record<string, unknown>,
): Partial<ClinicalVoiceParams> {
  const out: Partial<ClinicalVoiceParams> = {};
  for (const key of [
    "speech_rate",
    "pitch",
    "energy",
    "prosody",
    "breathing",
    "hesitation_frequency",
    "speaker_boost",
    "emotion_modulation",
    "pronunciation_ar",
    "pronunciation_en",
  ] as const) {
    if (key in body) {
      (out as Record<string, unknown>)[key] = body[key];
    }
  }
  return out;
}

/** Seed defaults used when backfilling existing registry rows. */
export function seedClinicalDefaultsForLanguage(
  language: string,
): ClinicalVoiceParams {
  const base = { ...DEFAULT_CLINICAL_VOICE_PARAMS };
  if (language === "ar") {
    return {
      ...base,
      pronunciation_ar: "Levantine Arabic; soft consonants; measured cadence",
      pronunciation_en: null,
    };
  }
  return {
    ...base,
    pronunciation_en: "General American; clear clinical interview cadence",
    pronunciation_ar: null,
  };
}

/**
 * Clinical Voice Profiles (CVP / Mission 3).
 *
 * Every patient voice is a registry row plus clinical delivery parameters.
 * Emotion modulation adjusts those parameters live without changing voice_id.
 */

import type { PreferredLanguage } from "@/lib/types";

/** Affect bands that drive live prosody switching. */
export type ClinicalEmotion =
  | "neutral"
  | "depressed"
  | "anxious"
  | "manic"
  | "psychotic";

export type ClinicalEnergy = "low" | "moderate" | "high" | "labile";

export type ClinicalBreathing =
  | "calm"
  | "short"
  | "deep"
  | "irregular"
  | "held";

export type ClinicalProsody =
  | "flat"
  | "measured"
  | "anxious_edge"
  | "pressured"
  | "fragmented"
  | "labile";

/** Clinical delivery parameters owned by a voice profile. */
export type ClinicalVoiceParams = {
  /** Relative speech rate (0.5–1.8). 1.0 = baseline. */
  speech_rate: number;
  /** Relative pitch (0.5–1.8). 1.0 = baseline. */
  pitch: number;
  energy: ClinicalEnergy;
  prosody: ClinicalProsody;
  breathing: ClinicalBreathing;
  /** 0–1: how often hesitations / fillers appear in delivery hints. */
  hesitation_frequency: number;
  /** Maps to ElevenLabs similarity_boost (0–1). */
  speaker_boost: number;
  /** When true, emotion live-switching is applied at TTS time. */
  emotion_modulation: boolean;
  /** Locale / dialect pronunciation guidance for Arabic TTS. */
  pronunciation_ar: string | null;
  /** Locale / dialect pronunciation guidance for English TTS. */
  pronunciation_en: string | null;
};

/**
 * Full clinical voice profile — registry identity + clinical params.
 * Mirrors `public.voice_profiles` after the CVP migration.
 */
export type ClinicalVoiceProfile = ClinicalVoiceParams & {
  id: string;
  provider: string;
  voice_name: string;
  voice_id: string;
  language: PreferredLanguage | (string & {});
  dialect: string | null;
  gender: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
};

/** Emotion delta applied on top of a baseline profile. */
export type EmotionModulationDelta = {
  speech_rate_mul: number;
  pitch_mul: number;
  energy?: ClinicalEnergy;
  prosody?: ClinicalProsody;
  breathing?: ClinicalBreathing;
  hesitation_delta: number;
  speaker_boost_delta: number;
  /** Pause / silence scaling (>1 = longer / more inappropriate pauses). */
  pause_scale: number;
  /** ElevenLabs stability nudge (absolute, clamped later). */
  stability_nudge: number;
  /** ElevenLabs style nudge. */
  style_nudge: number;
  summary: string;
};

/** Resolved live voice state after emotion modulation. */
export type EffectiveClinicalVoice = ClinicalVoiceParams & {
  emotion: ClinicalEmotion;
  pause_scale: number;
  voice_id: string;
  voice_profile_id: string;
  language: PreferredLanguage | (string & {});
  /** ElevenLabs voice_settings payload. */
  elevenlabs: {
    stability: number;
    similarity_boost: number;
    style: number;
  };
  /** Browser SpeechSynthesis / HTMLAudio hints. */
  browser: {
    rate: number;
    pitch: number;
    volume: number;
  };
  /** Human-readable modulation note for admin / telemetry. */
  modulation_note: string;
};

export type LiveSwitchRequest = {
  profile: ClinicalVoiceProfile | ClinicalVoiceParams & {
    id: string;
    voice_id: string;
    language: PreferredLanguage | (string & {});
  };
  emotion?: ClinicalEmotion | string | null;
  /** Optional disorder slug → inferred emotion when emotion omitted. */
  disorderSlug?: string | null;
};

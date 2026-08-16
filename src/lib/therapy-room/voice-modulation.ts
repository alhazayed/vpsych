import type { VoiceModulation } from "./types";
import { derivePatientBehavior } from "./pme-bridge";

/** Diagnosis-dependent voice modulation for TTS / browser speech. */
export function voiceModulationForDisorder(
  disorderSlug?: string | null,
  seed = "voice",
): VoiceModulation {
  return derivePatientBehavior({
    disorderSlug,
    phase: "speaking",
    seed,
  }).voice;
}

/**
 * Apply modulation to the Web Speech API utterance when provider TTS
 * is unavailable. The provider path uses its own voice settings;
 * rate/volume are applied client-side via playbackRate / volume on Audio.
 */
export function applyBrowserVoiceModulation(
  utterance: SpeechSynthesisUtterance,
  mod: VoiceModulation,
): void {
  utterance.rate = Math.max(0.5, Math.min(2, mod.rate));
  utterance.pitch = Math.max(0.5, Math.min(2, mod.pitch));
  utterance.volume = Math.max(0, Math.min(1, mod.volume));
}

export function applyHtmlAudioModulation(
  audio: HTMLAudioElement,
  mod: VoiceModulation,
): void {
  audio.playbackRate = Math.max(0.5, Math.min(2, mod.rate));
  audio.volume = Math.max(0, Math.min(1, mod.volume));
}

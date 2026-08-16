/**
 * Clinical delivery signals → Google `audioConfig` parameters.
 *
 * This adapter is the ONLY place that reinterprets clinical prosody for Google.
 * `lib/clinical-voice`, `lib/humanization`, `lib/emotion`, and
 * `lib/voice/prosody` are untouched: they keep producing the same values, and
 * this module decides which of them Google can actually honor.
 *
 * Honesty rule — a signal is either genuinely applied or reported as
 * unsupported. No invented equivalents:
 *
 *   speech_rate      → audioConfig.speakingRate  (same semantics: multiplier,
 *                      1.0 = baseline) — but only on voices that accept it.
 *   pitch            → audioConfig.pitch in semitones (12·log2(ratio)) — again
 *                      only on voices that accept it.
 *   pause_scale      → NOT APPLIED. Google exposes no audioConfig pause knob,
 *                      and the alternative (injecting pause markup into the
 *                      text) would mean editing clinical dialogue, which is
 *                      forbidden. The client-side thinking pause
 *                      (`pauseBeforeMs` in conversation-pipeline) is
 *                      provider-independent and still works.
 *   stability        → NOT APPLIED. No Google equivalent.
 *   similarity_boost → NOT APPLIED. No Google equivalent.
 *   style            → NOT APPLIED. No Google equivalent.
 *
 * Clinical emotion classification itself is upstream and unchanged. Emotion
 * reaches Google only insofar as it already moved `speech_rate` / `pitch`
 * inside the clinical layer, and only where the voice supports those knobs.
 */

/** Google audioConfig ranges. */
const SPEAKING_RATE_MIN = 0.25;
const SPEAKING_RATE_MAX = 2.0;
const PITCH_SEMITONES_MIN = -20;
const PITCH_SEMITONES_MAX = 20;

/** Below this delta from baseline, sending the parameter is pointless. */
const RATE_EPSILON = 0.01;
const PITCH_EPSILON = 0.05;

export type GoogleVoiceCapabilities = {
  speakingRate: boolean;
  pitch: boolean;
  ssml: boolean;
};

/**
 * Chirp 3 HD (and Chirp generally) does not accept SSML input or the
 * speakingRate / pitch audio parameters — Google returns 400
 * ("This voice does not support pitch parameters at this time").
 * Classic voice families (Standard / WaveNet / Neural2 / Studio) do.
 */
export function googleVoiceCapabilities(
  voiceName: string,
): GoogleVoiceCapabilities {
  const isChirp = /-chirp/i.test(voiceName);
  if (isChirp) {
    return { speakingRate: false, pitch: false, ssml: false };
  }
  return { speakingRate: true, pitch: true, ssml: true };
}

export type GoogleProsodyAudioConfig = {
  speakingRate?: number;
  pitch?: number;
};

export type GoogleProsodyResult = {
  /** Fields to merge into the request's audioConfig. */
  audioConfig: GoogleProsodyAudioConfig;
  /** Clinical signals genuinely applied. */
  applied: string[];
  /** Clinical signals received but NOT applied, with the reason. */
  unsupported: Array<{ signal: string; reason: string }>;
};

export type GoogleProsodyInput = {
  voiceName: string;
  /** Clinical multiplier around 1.0 (CVP range 0.5–1.8). */
  speechRate?: number | null;
  /** Clinical multiplier around 1.0 (CVP range 0.5–1.8). */
  pitch?: number | null;
  pauseScale?: number | null;
  stability?: number | null;
  similarityBoost?: number | null;
  style?: number | null;
  /** Override for the Chirp speakingRate restriction (benchmark escape hatch). */
  allowSpeakingRate?: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function isUsableNumber(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Translate clinical voice parameters into Google audioConfig fields.
 * Returns both what was applied and what was dropped, so callers can log and
 * document the gap instead of implying full parity.
 */
export function googleProsodyFromClinicalVoice(
  input: GoogleProsodyInput,
): GoogleProsodyResult {
  const caps = googleVoiceCapabilities(input.voiceName);
  const audioConfig: GoogleProsodyAudioConfig = {};
  const applied: string[] = [];
  const unsupported: Array<{ signal: string; reason: string }> = [];

  const rateAllowed = caps.speakingRate || input.allowSpeakingRate === true;

  // speech_rate → speakingRate (identical semantics: multiplier, 1.0 baseline)
  if (isUsableNumber(input.speechRate)) {
    if (!rateAllowed) {
      unsupported.push({
        signal: "speech_rate",
        reason: "voice_rejects_speaking_rate",
      });
    } else if (Math.abs(input.speechRate - 1) < RATE_EPSILON) {
      // Baseline — omitting the field is the same as sending 1.0.
    } else {
      audioConfig.speakingRate = round2(
        clamp(input.speechRate, SPEAKING_RATE_MIN, SPEAKING_RATE_MAX),
      );
      applied.push("speech_rate");
    }
  }

  // pitch (ratio) → pitch (semitones). 12·log2(ratio) is the standard
  // frequency-ratio → semitone conversion, not an invented scale.
  if (isUsableNumber(input.pitch)) {
    if (!caps.pitch) {
      unsupported.push({ signal: "pitch", reason: "voice_rejects_pitch" });
    } else if (Math.abs(input.pitch - 1) < PITCH_EPSILON) {
      // Baseline.
    } else {
      const semitones = 12 * Math.log2(input.pitch);
      audioConfig.pitch = round2(
        clamp(semitones, PITCH_SEMITONES_MIN, PITCH_SEMITONES_MAX),
      );
      applied.push("pitch");
    }
  }

  if (isUsableNumber(input.pauseScale) && Math.abs(input.pauseScale - 1) >= 0.01) {
    unsupported.push({
      signal: "pause_scale",
      reason: "no_audioconfig_equivalent",
    });
  }

  for (const [signal, value] of [
    ["stability", input.stability],
    ["similarity_boost", input.similarityBoost],
    ["style", input.style],
  ] as const) {
    if (typeof value === "number" && Number.isFinite(value)) {
      unsupported.push({ signal, reason: "provider_has_no_equivalent" });
    }
  }

  return { audioConfig, applied, unsupported };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

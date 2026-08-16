/**
 * Clinical delivery signals → Google `audioConfig` parameters.
 *
 * This adapter is the ONLY place that reinterprets clinical prosody for Google.
 * `lib/clinical-voice`, `lib/humanization`, `lib/emotion`, and
 * `lib/voice/prosody` are untouched: they keep producing the same values, and
 * this module decides which of them Google can actually honor.
 *
 * Two independent gates, never conflated:
 *   1. CAPABILITY  — does Google document support? (`capabilities.ts`)
 *   2. ENABLEMENT  — has VPsych approved it for this environment? (feature flag)
 * A signal is applied only when both are true, and every signal that is not
 * applied is reported with the reason. No invented equivalents.
 *
 *   speech_rate      → audioConfig.speakingRate. Same semantics (multiplier,
 *                      1.0 = baseline), documented range [0.25, 2.0], and
 *                      documented for Chirp 3 HD across all locales.
 *   pitch            → audioConfig.pitch in semitones (12·log2(ratio)).
 *                      Chirp 3 HD REJECTS pitch, so it is never sent there.
 *   pause_scale      → not an audioConfig field. Handled separately as Chirp 3
 *                      HD pause markup (`markup.ts`), not faked here.
 *   stability        → NOT APPLIED. No Google equivalent.
 *   similarity_boost → NOT APPLIED. No Google equivalent.
 *   style            → NOT APPLIED. No Google equivalent.
 *
 * Clinical emotion classification is upstream and unchanged. Emotion reaches
 * Google only insofar as it already moved `speech_rate` / `pitch` inside the
 * clinical layer, and only where the voice and the flags permit.
 */

import {
  googleSupports,
  PITCH_SEMITONE_RANGE,
  SPEAKING_RATE_RANGE,
} from "@/lib/voice/google/capabilities";

/** Below this delta from baseline, sending the parameter is pointless. */
const RATE_EPSILON = 0.01;
const PITCH_EPSILON = 0.05;

export type GoogleProsodyAudioConfig = {
  speakingRate?: number;
  pitch?: number;
};

export type UnsupportedReason =
  | "voice_rejects_parameter"
  | "not_enabled"
  | "handled_as_markup"
  | "provider_has_no_equivalent";

export type GoogleProsodyResult = {
  /** Fields to merge into the request's audioConfig. */
  audioConfig: GoogleProsodyAudioConfig;
  /** Clinical signals genuinely applied. */
  applied: string[];
  /** Clinical signals received but NOT applied, with the reason. */
  unsupported: Array<{ signal: string; reason: UnsupportedReason }>;
};

export type GoogleProsodyInput = {
  voiceName: string;
  languageCode: string;
  /** Clinical multiplier around 1.0 (CVP range 0.5–1.8). */
  speechRate?: number | null;
  /** Clinical multiplier around 1.0 (CVP range 0.5–1.8). */
  pitch?: number | null;
  pauseScale?: number | null;
  stability?: number | null;
  similarityBoost?: number | null;
  style?: number | null;
  /**
   * Enablement flag for pace control. Google documents Chirp 3 HD support;
   * VPsych keeps it opt-in so production stays conservative until the
   * benchmark signs it off.
   */
  enableSpeakingRate?: boolean;
  /** Enablement flag for pause markup — reporting only; see `markup.ts`. */
  enablePauseControl?: boolean;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function isUsableNumber(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Translate clinical voice parameters into Google audioConfig fields.
 * Returns both what was applied and what was dropped, so callers can log and
 * document the gap instead of implying full parity.
 */
export function googleProsodyFromClinicalVoice(
  input: GoogleProsodyInput,
): GoogleProsodyResult {
  const { voiceName, languageCode } = input;
  const audioConfig: GoogleProsodyAudioConfig = {};
  const applied: string[] = [];
  const unsupported: GoogleProsodyResult["unsupported"] = [];

  // ── speech_rate → speakingRate ──────────────────────────────────────
  if (isUsableNumber(input.speechRate)) {
    const capable = googleSupports("speaking_rate", voiceName, languageCode);
    const enabled = input.enableSpeakingRate === true;

    if (!capable) {
      unsupported.push({
        signal: "speech_rate",
        reason: "voice_rejects_parameter",
      });
    } else if (!enabled) {
      unsupported.push({ signal: "speech_rate", reason: "not_enabled" });
    } else if (Math.abs(input.speechRate - 1) < RATE_EPSILON) {
      // Baseline — omitting the field is the same as sending 1.0.
    } else {
      audioConfig.speakingRate = round2(
        clamp(
          input.speechRate,
          SPEAKING_RATE_RANGE.min,
          SPEAKING_RATE_RANGE.max,
        ),
      );
      applied.push("speech_rate");
    }
  }

  // ── pitch (ratio) → pitch (semitones) ───────────────────────────────
  // 12·log2(ratio) is the standard frequency-ratio → semitone conversion,
  // not an invented scale.
  if (isUsableNumber(input.pitch)) {
    if (!googleSupports("pitch", voiceName, languageCode)) {
      unsupported.push({ signal: "pitch", reason: "voice_rejects_parameter" });
    } else if (Math.abs(input.pitch - 1) < PITCH_EPSILON) {
      // Baseline.
    } else {
      audioConfig.pitch = round2(
        clamp(
          12 * Math.log2(input.pitch),
          PITCH_SEMITONE_RANGE.min,
          PITCH_SEMITONE_RANGE.max,
        ),
      );
      applied.push("pitch");
    }
  }

  // ── pause_scale → markup, never audioConfig ─────────────────────────
  if (isUsableNumber(input.pauseScale) && Math.abs(input.pauseScale - 1) >= 0.01) {
    const capable = googleSupports("pause_control", voiceName, languageCode);
    if (!capable) {
      unsupported.push({
        signal: "pause_scale",
        reason: "voice_rejects_parameter",
      });
    } else if (input.enablePauseControl !== true) {
      unsupported.push({ signal: "pause_scale", reason: "not_enabled" });
    } else {
      // Applied by `buildPauseMarkup`, not by audioConfig.
      unsupported.push({ signal: "pause_scale", reason: "handled_as_markup" });
    }
  }

  // ── ElevenLabs-only expressiveness controls ─────────────────────────
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

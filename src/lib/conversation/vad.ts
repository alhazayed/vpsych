import type { VadEvent, VadFrameResult } from "@/lib/conversation/types";

export type VadConfig = {
  /** Min silence after speech before speech_end (ms). Clamped 600–900. */
  minSilenceMs: number;
  /** Voice sensitivity 0–1 — higher lowers speech energy threshold. */
  sensitivity: number;
  sampleRate: number;
  /** Require this much continuous speech before speech_start (ms). */
  minSpeechMs: number;
  /** Ignore frames shorter than this as click/keyboard transients (ms). */
  transientMaxMs: number;
};

export const DEFAULT_VAD_CONFIG: VadConfig = {
  minSilenceMs: 750,
  sensitivity: 0.55,
  sampleRate: 16000,
  minSpeechMs: 120,
  transientMaxMs: 45,
};

export function clampSilenceMs(ms: number): number {
  if (!Number.isFinite(ms)) return 750;
  return Math.min(900, Math.max(600, Math.round(ms)));
}

function rms(frame: Float32Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const s = frame[i]!;
    sum += s * s;
  }
  return Math.sqrt(sum / frame.length);
}

function peakAbs(frame: Float32Array): number {
  let p = 0;
  for (let i = 0; i < frame.length; i++) {
    const a = Math.abs(frame[i]!);
    if (a > p) p = a;
  }
  return p;
}

/**
 * Rough spectral flatness via time-domain zero-crossing + energy envelope.
 * High ZCR + moderate energy → noise-like (fan); low ZCR + energy → speech.
 * Pure FFT would be better but this stays dependency-free and deterministic.
 */
function noiseLikeness(frame: Float32Array): number {
  if (frame.length < 2) return 1;
  let zc = 0;
  for (let i = 1; i < frame.length; i++) {
    const a = frame[i - 1]!;
    const b = frame[i]!;
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) zc += 1;
  }
  const zcr = zc / (frame.length - 1);
  // Speech typically 0.02–0.15 ZCR at 16k; fan/hiss higher.
  const flat = Math.min(1, Math.max(0, (zcr - 0.02) / 0.35));
  return flat;
}

export function analyzeVadFrame(
  frame: Float32Array,
  config: Pick<VadConfig, "sensitivity">,
): VadFrameResult {
  const energy = rms(frame);
  const peak = peakAbs(frame);
  const flatness = noiseLikeness(frame);
  const clipping = peak >= 0.98;

  // Map sensitivity → energy threshold (higher sensitivity = lower threshold).
  const s = Math.min(1, Math.max(0, config.sensitivity));
  const speechThreshold = 0.045 - s * 0.028; // ~0.017–0.045
  const noiseFloor = 0.008 - s * 0.004;

  // Reject steady high-flatness noise (fan) even if energetic.
  const fanLike = flatness > 0.72 && energy < speechThreshold * 2.2;
  // Reject impulsive clicks / keyboard: high crest factor (peak >> RMS).
  const crest = energy > 1e-6 ? peak / energy : 0;
  const clickLike =
    (peak > 0.55 && energy < speechThreshold * 0.85 && flatness > 0.4) ||
    (peak > 0.5 && crest >= 5);

  const isSpeech =
    !fanLike &&
    !clickLike &&
    energy >= speechThreshold &&
    flatness < 0.85;

  const rejectedTransient = clickLike;

  let confidence = 0;
  if (isSpeech) {
    const headroom = Math.min(1, (energy - speechThreshold) / (speechThreshold * 3));
    confidence = Math.min(1, 0.35 + headroom * 0.5 + (1 - flatness) * 0.25);
  } else if (energy > noiseFloor) {
    confidence = Math.min(0.4, energy * 4);
  }

  return {
    isSpeech,
    energy,
    flatness,
    rejectedTransient,
    confidence,
    clipping,
  };
}

type VadPhase = "idle" | "speech" | "trailing_silence";

/**
 * Streaming Voice Activity Detector — never timeout-only.
 * Emits speech_start / speech_end / interruption / noise from frame analysis.
 */
export class VoiceActivityDetector {
  private config: VadConfig;
  private phase: VadPhase = "idle";
  private speechMs = 0;
  private silenceMs = 0;
  private utteranceMs = 0;
  private lastConfidence = 0;
  private confidenceSamples = 0;
  private confidenceSum = 0;
  private transientMs = 0;
  private listeningForInterrupt = false;

  constructor(config?: Partial<VadConfig>) {
    this.config = {
      ...DEFAULT_VAD_CONFIG,
      ...config,
      minSilenceMs: clampSilenceMs(
        config?.minSilenceMs ?? DEFAULT_VAD_CONFIG.minSilenceMs,
      ),
    };
  }

  updateConfig(patch: Partial<VadConfig>) {
    this.config = {
      ...this.config,
      ...patch,
      minSilenceMs: clampSilenceMs(
        patch.minSilenceMs ?? this.config.minSilenceMs,
      ),
    };
  }

  setInterruptMode(enabled: boolean) {
    this.listeningForInterrupt = enabled;
  }

  reset() {
    this.phase = "idle";
    this.speechMs = 0;
    this.silenceMs = 0;
    this.utteranceMs = 0;
    this.transientMs = 0;
    this.lastConfidence = 0;
  }

  meanConfidence(): number {
    if (this.confidenceSamples === 0) return 0;
    return this.confidenceSum / this.confidenceSamples;
  }

  /**
   * Process one PCM frame. frameDurationMs derived from length + sampleRate
   * when not provided.
   */
  process(
    frame: Float32Array,
    frameDurationMs?: number,
  ): { events: VadEvent[]; analysis: VadFrameResult } {
    const ms =
      frameDurationMs ??
      (frame.length / this.config.sampleRate) * 1000;
    const analysis = analyzeVadFrame(frame, this.config);
    const events: VadEvent[] = [];

    if (analysis.rejectedTransient) {
      this.transientMs += ms;
      if (this.transientMs <= this.config.transientMaxMs) {
        return { events, analysis };
      }
      // Sustained beyond transient window — treat as possible speech below.
    } else {
      this.transientMs = 0;
    }

    if (!analysis.isSpeech && analysis.energy > 0.012 && analysis.flatness > 0.65) {
      events.push({ type: "noise", energy: analysis.energy });
    }

    if (analysis.isSpeech) {
      this.confidenceSum += analysis.confidence;
      this.confidenceSamples += 1;
      this.lastConfidence = analysis.confidence;
      this.speechMs += ms;
      this.silenceMs = 0;

      if (this.listeningForInterrupt && this.phase === "idle") {
        if (this.speechMs >= this.config.minSpeechMs) {
          events.push({
            type: "interruption",
            confidence: analysis.confidence,
          });
          this.phase = "speech";
          this.utteranceMs = this.speechMs;
        }
        return { events, analysis };
      }

      if (this.phase === "idle") {
        if (this.speechMs >= this.config.minSpeechMs) {
          this.phase = "speech";
          this.utteranceMs = this.speechMs;
          events.push({
            type: "speech_start",
            confidence: analysis.confidence,
          });
        }
      } else if (this.phase === "trailing_silence") {
        this.phase = "speech";
        this.utteranceMs += ms;
      } else {
        this.utteranceMs += ms;
      }
    } else {
      this.speechMs = 0;
      if (this.phase === "speech" || this.phase === "trailing_silence") {
        this.silenceMs += ms;
        this.phase = "trailing_silence";
        if (this.silenceMs >= this.config.minSilenceMs) {
          events.push({
            type: "speech_end",
            confidence: this.lastConfidence,
            durationMs: this.utteranceMs,
          });
          this.phase = "idle";
          this.silenceMs = 0;
          this.utteranceMs = 0;
        }
      }
    }

    return { events, analysis };
  }
}

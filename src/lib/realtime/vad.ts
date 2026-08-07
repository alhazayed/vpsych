/**
 * Voice Activity Detection helpers for the realtime gateway.
 * Energy-based; language-agnostic. Complements `lib/therapy-room/vad`.
 */

export type VadFrame = {
  rms: number;
  speaking: boolean;
  speechMs: number;
};

export type VadOptions = {
  speechThreshold?: number;
  silenceThreshold?: number;
};

export function createVad(opts: VadOptions = {}) {
  const speechThreshold = opts.speechThreshold ?? 0.02;
  const silenceThreshold = opts.silenceThreshold ?? 0.012;
  let speaking = false;
  let speechMs = 0;

  return {
    process(rms: number, dtMs: number): VadFrame {
      if (!speaking && rms >= speechThreshold) {
        speaking = true;
      } else if (speaking && rms < silenceThreshold) {
        speaking = false;
      }
      if (speaking) speechMs += dtMs;
      return { rms, speaking, speechMs };
    },
    reset() {
      speaking = false;
      speechMs = 0;
    },
    isSpeaking() {
      return speaking;
    },
  };
}

/** RMS of a PCM float32 frame. */
export function computeRms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

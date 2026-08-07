/**
 * Silence detection — presentation / capture helper.
 * Complements therapy-room VAD; does not own patient cognition.
 */

export type SilenceDetectorOptions = {
  silenceThreshold?: number;
  silenceMs?: number;
  minSpeechMs?: number;
};

export type SilenceDetectorState = {
  speaking: boolean;
  speechMs: number;
  silenceMs: number;
  turnEnded: boolean;
};

export function createSilenceDetector(opts: SilenceDetectorOptions = {}) {
  const silenceThreshold = opts.silenceThreshold ?? 0.015;
  const silenceBudgetMs = opts.silenceMs ?? 850;
  const minSpeechMs = opts.minSpeechMs ?? 250;

  let speaking = false;
  let speechMs = 0;
  let silenceMs = 0;
  let turnEnded = false;

  return {
    push(rms: number, dtMs: number): SilenceDetectorState {
      if (turnEnded) {
        return { speaking, speechMs, silenceMs, turnEnded };
      }
      if (rms >= silenceThreshold) {
        speaking = true;
        speechMs += dtMs;
        silenceMs = 0;
      } else if (speaking) {
        silenceMs += dtMs;
        if (speechMs >= minSpeechMs && silenceMs >= silenceBudgetMs) {
          turnEnded = true;
          speaking = false;
        }
      }
      return { speaking, speechMs, silenceMs, turnEnded };
    },
    reset() {
      speaking = false;
      speechMs = 0;
      silenceMs = 0;
      turnEnded = false;
    },
    snapshot(): SilenceDetectorState {
      return { speaking, speechMs, silenceMs, turnEnded };
    },
  };
}

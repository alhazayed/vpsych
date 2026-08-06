/**
 * Preferred getUserMedia constraints for Therapy Room hands-free capture.
 * Echo cancellation + noise suppression + AGC reduce feedback when TTS plays
 * and keep English / Arabic speech levels stable across devices.
 *
 * All values use `ideal` (not exact). Bare `true` / number constraints are
 * treated as exact on some Safari / WebKit builds and throw OverconstrainedError,
 * which previously aborted the hands-free boot into ERROR + Retry.
 */

export const HANDS_FREE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: { ideal: 1 },
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
};

/** Constraints used while monitoring for barge-in (no capture retained). */
export const BARGE_IN_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: { ideal: 1 },
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
};

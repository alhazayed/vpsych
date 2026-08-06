/**
 * Preferred getUserMedia constraints for Therapy Room hands-free capture.
 * Echo cancellation + noise suppression + AGC reduce feedback when TTS plays
 * and keep English / Arabic speech levels stable across devices.
 */

export const HANDS_FREE_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/** Constraints used while monitoring for barge-in (no capture retained). */
export const BARGE_IN_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 1,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

/**
 * Microphone Pipeline — capture constraints + arming state (browser-side).
 * Does not store audio beyond the active turn buffer.
 */

export type MicPipelineState =
  | "idle"
  | "requesting_permission"
  | "armed"
  | "capturing"
  | "denied"
  | "error";

export type MicPipelineConfig = {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  channelCount: number;
};

export const DEFAULT_MIC_CONSTRAINTS: MicPipelineConfig = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

export function toMediaTrackConstraints(
  config: MicPipelineConfig = DEFAULT_MIC_CONSTRAINTS,
): MediaTrackConstraints {
  return {
    echoCancellation: config.echoCancellation,
    noiseSuppression: config.noiseSuppression,
    autoGainControl: config.autoGainControl,
    channelCount: config.channelCount,
  };
}

export function createMicrophonePipeline() {
  let state: MicPipelineState = "idle";
  let lastError: string | null = null;

  return {
    state: () => state,
    lastError: () => lastError,
    beginPermissionRequest() {
      state = "requesting_permission";
      lastError = null;
    },
    arm() {
      state = "armed";
    },
    startCapture() {
      state = "capturing";
    },
    deny(message = "Microphone permission denied") {
      state = "denied";
      lastError = message;
    },
    fail(message: string) {
      state = "error";
      lastError = message;
    },
    reset() {
      state = "idle";
      lastError = null;
    },
  };
}

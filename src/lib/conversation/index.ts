/**
 * Hands-Free Therapy Engine (HFTE) — conversation UX layer.
 * Does not alter clinical reasoning, patient personality, scoring, ACE, TRE, or PME.
 */

export { isHandsFreeTherapyEnabled } from "@/lib/conversation/feature-flag";
export {
  ConversationController,
  InvalidConversationTransitionError,
  assertTransition,
  canTransition,
} from "@/lib/conversation/state-machine";
export type { ConversationControllerSnapshot } from "@/lib/conversation/state-machine";
export {
  VoiceActivityDetector,
  analyzeVadFrame,
  clampSilenceMs,
  DEFAULT_VAD_CONFIG,
} from "@/lib/conversation/vad";
export type { VadConfig } from "@/lib/conversation/vad";
export {
  computeThinkingDelayMs,
  sleepMs,
  DEFAULT_THINKING_DELAY,
} from "@/lib/conversation/thinking-delay";
export {
  selectVocalization,
  composeTtsText,
} from "@/lib/conversation/vocalization";
export {
  normalizeVoicePreferences,
  loadLocalVoicePreferences,
  saveLocalVoicePreferences,
  mergeVoicePreferences,
} from "@/lib/conversation/preferences";
export {
  createEmptyMetrics,
  recordTurn,
  recordPause,
  recordNetworkDisconnect,
  summarizeMetrics,
  metricsPayload,
} from "@/lib/conversation/metrics";
export {
  createPendingTurnGuard,
  canSubmitTranscript,
  markTurnInFlight,
  markTurnSucceeded,
  markTurnFailed,
  turnDedupKey,
  initialNetworkStatus,
} from "@/lib/conversation/recovery";
export type { NetworkStatus, PendingTurnGuard } from "@/lib/conversation/recovery";
export { pmeUxCuesFromSession } from "@/lib/conversation/pme-cues";
export { startContinuousMic } from "@/lib/conversation/continuous-mic";
export type {
  ContinuousMicSession,
  ContinuousMicHandlers,
  WaveformSample,
} from "@/lib/conversation/continuous-mic";
export { DEFAULT_VOICE_PREFERENCES } from "@/lib/conversation/types";
export type {
  ConversationState,
  SessionStatusKind,
  ConversationMode,
  VoiceConversationPreferences,
  HfteSessionMetrics,
  HfteTurnMetricSample,
  PmeUxCues,
  VocalizationKind,
  VadFrameResult,
  VadEvent,
} from "@/lib/conversation/types";

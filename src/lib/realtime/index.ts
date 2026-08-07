/**
 * Stage 11 — Real-Time Clinical Simulation Platform.
 *
 * Voice gateway, streaming audio, avatar presentation, multilingual media UX,
 * session experience chrome, and realtime observability.
 *
 * Presentation layer only.
 * NEVER modifies patient behaviour, cognition, memory, emotion, adaptation,
 * case engine, clinical intelligence, validation ownership, supervisor skill
 * evaluation, or enterprise tenancy ownership.
 */

export {
  REALTIME_VERSION,
  REALTIME_VOICE_GATEWAY_VERSION,
  REALTIME_AVATAR_VERSION,
  REALTIME_STREAMING_VERSION,
  REALTIME_INTERACTION_LATENCY_TARGET_MS,
  REALTIME_E2E_VOICE_TURN_P50_MS,
  REALTIME_E2E_VOICE_TURN_P95_MS,
} from "@/lib/realtime/types";
export type * from "@/lib/realtime/types";

export {
  REALTIME_FORBIDDEN_WRITES,
  REALTIME_OWNERSHIP_RULE,
  buildRealtimeVersionLock,
} from "@/lib/realtime/versions";

export {
  isRealtimeSimulationEnabled,
  isRealtimeStreamingEnabled,
} from "@/lib/realtime/feature-flag";

export { createVoiceGateway } from "@/lib/realtime/voice-gateway";
export type { VoiceGateway } from "@/lib/realtime/voice-gateway";

export {
  createStreamingAudioManager,
  chunkTextForSpeech,
} from "@/lib/realtime/streaming-audio";
export {
  createMicrophonePipeline,
  DEFAULT_MIC_CONSTRAINTS,
  toMediaTrackConstraints,
} from "@/lib/realtime/microphone-pipeline";
export {
  createSpeakerPipeline,
  normalizePeakScale,
} from "@/lib/realtime/speaker-pipeline";
export {
  detectTurnPhase,
  shouldCommitTherapistTurn,
} from "@/lib/realtime/turn-detection";
export {
  planInterrupt,
  gatewayStateAfterInterrupt,
} from "@/lib/realtime/interrupt-handling";
export { createLatencyController } from "@/lib/realtime/latency-controller";
export { createAudioBufferManager } from "@/lib/realtime/audio-buffer";
export { createSilenceDetector } from "@/lib/realtime/silence-detection";
export { createVad, computeRms } from "@/lib/realtime/vad";
export {
  createReconnectController,
  connectionAfterReconnect,
} from "@/lib/realtime/reconnect";
export {
  adaptQuality,
  estimateNetworkFromRtt,
} from "@/lib/realtime/quality-adaptation";

export {
  createTokenStreamController,
  withStreamRetry,
  encodeSse,
  createSseResponse,
  progressiveTokens,
} from "@/lib/realtime/llm-streaming";

export {
  createAvatarController,
  visemeClass,
} from "@/lib/realtime/avatar-controller";
export { buildNonverbalPresentation } from "@/lib/realtime/nonverbal-sync";
export { buildVoicePersonality } from "@/lib/realtime/voice-personality";

export {
  detectSpeechLocale,
  isRtlLocale,
  createMultilingualSession,
  applyRuntimeLanguageSwitch,
  observeUtterance,
  toBidirectionalLine,
  speechLocaleForProviders,
} from "@/lib/realtime/multilingual";

export {
  createInitialSessionExperience,
  enterSessionFloor,
  patchConnection,
  patchVoiceGateway,
  patchNetwork,
  tickSessionTimer,
  pauseSession,
  resumeSession,
  emergencyTerminate,
} from "@/lib/realtime/session-experience";

export {
  realtimeMetrics,
  createRealtimeMetricsStore,
  clearRealtimeMetricsForTests,
} from "@/lib/realtime/observability";
export type { RealtimeMetricsSummary } from "@/lib/realtime/observability";

export {
  DEFAULT_ACCESSIBILITY,
  createAccessibilityControls,
  clampSpeed,
  REALTIME_KEYBOARD_SHORTCUTS,
  announceForScreenReader,
} from "@/lib/realtime/accessibility";

export {
  createSecurityContext,
  markPermissionValidated,
  rotateStreamToken,
  isTokenExpired,
  buildReplayId,
  createReplayGuard,
} from "@/lib/realtime/security";

export {
  runRealtimeEngine,
  buildRealtimeDashboard,
  createRealtimeRuntime,
} from "@/lib/realtime/engine";

export { runRealtimeAfterAssessment } from "@/lib/realtime/session-bridge";
export type { RealtimeBridgeResult } from "@/lib/realtime/session-bridge";

export { submitStreamingConversationTurn } from "@/lib/realtime/client-pipeline";
export type { StreamTurnHandlers } from "@/lib/realtime/client-pipeline";

export {
  buildStatusEvent,
  progressiveRevealEvents,
  sseEncoder,
} from "@/lib/realtime/stream-message";

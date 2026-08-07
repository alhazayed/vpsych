/**
 * Stage 11 — Real-Time Clinical Simulation types.
 *
 * Presentation / media / session-experience contracts only.
 * Patient cognition remains owned by Case · Emotion · Adaptation · CI · CBE · Patient Agent.
 */

export const REALTIME_VERSION = "1.0.0" as const;
export const REALTIME_VOICE_GATEWAY_VERSION = "1.0.0" as const;
export const REALTIME_AVATAR_VERSION = "1.0.0" as const;
export const REALTIME_STREAMING_VERSION = "1.0.0" as const;

/** Interaction latency target where platform supports it (local UX loops). */
export const REALTIME_INTERACTION_LATENCY_TARGET_MS = 250;

/** Soft E2E voice-turn budget (STT→LLM→TTS) — aligns with LATENCY_BUDGET.md. */
export const REALTIME_E2E_VOICE_TURN_P50_MS = 6000;
export const REALTIME_E2E_VOICE_TURN_P95_MS = 15000;

export type RealtimeSpeechLocale = "en" | "ar" | "mixed";

export type NetworkQuality =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "offline";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "degraded"
  | "paused"
  | "terminated"
  | "error";

export type VoiceGatewayState =
  | "idle"
  | "mic_arming"
  | "listening"
  | "vad_speech"
  | "silence_hold"
  | "transcribing"
  | "awaiting_model"
  | "streaming_tokens"
  | "synthesizing"
  | "speaking"
  | "interrupted"
  | "recovering"
  | "error";

export type TurnPhase =
  | "waiting"
  | "therapist_speaking"
  | "therapist_silence"
  | "patient_thinking"
  | "patient_streaming"
  | "patient_speaking"
  | "barge_in"
  | "paused";

export type InterruptReason =
  | "therapist_barge_in"
  | "user_cancel"
  | "network_loss"
  | "timeout"
  | "emergency_stop"
  | "session_expired";

export type StreamEventType =
  | "status"
  | "token"
  | "partial"
  | "speech_chunk"
  | "avatar"
  | "metric"
  | "error"
  | "done"
  | "interrupted"
  | "resume";

export type StreamEvent = {
  type: StreamEventType;
  ts: number;
  sequence: number;
  payload?: Record<string, unknown>;
};

export type LatencySample = {
  stage:
    | "mic_open"
    | "vad_decision"
    | "stt"
    | "llm_ttfb"
    | "llm_token"
    | "tts_ttfb"
    | "playback_start"
    | "avatar_sync"
    | "e2e_turn"
    | "interaction";
  ms: number;
  ok: boolean;
  at: string;
};

export type RealtimeMetricEvent = {
  kind:
    | "latency"
    | "packet_loss"
    | "reconnect"
    | "speech_failure"
    | "tts_failure"
    | "stt_failure"
    | "stream_interrupt"
    | "avatar_sync"
    | "network_quality";
  sessionId?: string;
  value?: number;
  detail?: string;
  at: string;
};

export type AudioBufferStats = {
  queuedBytes: number;
  droppedChunks: number;
  underruns: number;
  overruns: number;
};

export type QualityAdaptationDecision = {
  network: NetworkQuality;
  /** Suggested TTS chunk size in characters. */
  ttsChunkChars: number;
  /** Suggested max tokens for streamed replies. */
  maxOutputTokens: number;
  /** Prefer lower-bitrate / shorter audio when poor. */
  preferLowBandwidth: boolean;
  speechRateScale: number;
};

export type VoicePersonalityProfile = {
  ageBand: "young_adult" | "adult" | "middle_age" | "older_adult" | "unknown";
  genderPresentation: "feminine" | "masculine" | "neutral" | "unknown";
  accentHint: string | null;
  educationHint: string | null;
  cultureHint: string | null;
  prosody: {
    stability: number;
    style: number;
    speechPace: "slow" | "normal" | "fast";
    speechEnergy: "low" | "medium" | "high";
  };
  speechTempo: number;
  vocabularyRegister: "concrete" | "mixed" | "abstract";
  confidence: number;
  emotionalTone: string;
  locale: RealtimeSpeechLocale;
};

export type AvatarExpression =
  | "neutral"
  | "soft_smile"
  | "tense"
  | "sad"
  | "anxious"
  | "avoidant"
  | "engaged"
  | "thinking"
  | "speaking";

export type AvatarPose = {
  expression: AvatarExpression;
  eyeContact: number;
  gazeX: number;
  gazeY: number;
  blink: boolean;
  breathingPhase: number;
  headYaw: number;
  headPitch: number;
  headRoll: number;
  gesture:
    | "none"
    | "fidget"
    | "self_soothe"
    | "open_hand"
    | "shrug"
    | "withdraw";
  speakingIntensity: number;
  /** 0–1 mouth openness for lip sync approximation. */
  visemeOpen: number;
  lipSyncActive: boolean;
  idleIntensity: number;
};

export type NonverbalPresentation = {
  eyeContact: number;
  hesitationMs: number;
  pauseMs: number;
  thinkingDelayMs: number;
  avoidance: number;
  bodyOrientation: number;
  speechRate: number;
  speechVolume: number;
  speechRhythm: "even" | "halting" | "rushed" | "monotone";
  emotionalCongruence: number;
};

export type MultilingualSessionState = {
  primary: RealtimeSpeechLocale;
  detected: RealtimeSpeechLocale;
  runtimeSwitchAllowed: boolean;
  rtl: boolean;
  bidirectionalTranscript: boolean;
  lastSwitchAt: string | null;
};

export type SessionExperienceState = {
  connection: ConnectionState;
  voiceGateway: VoiceGatewayState;
  turn: TurnPhase;
  network: NetworkQuality;
  latencyMs: number | null;
  voiceQuality: number;
  reconnectAttempt: number;
  sessionElapsedSec: number;
  sessionRemainingSec: number;
  paused: boolean;
  captionsEnabled: boolean;
  transcriptMode: boolean;
  waitingRoom: boolean;
  emergencyTermination: boolean;
};

export type AccessibilityControls = {
  captions: boolean;
  transcriptMode: boolean;
  keyboardShortcuts: boolean;
  screenReaderAnnouncements: boolean;
  volumeNormalization: boolean;
  speechSpeedScale: number;
};

export type RealtimeSecurityContext = {
  mediaEncrypted: boolean;
  streamingSecure: boolean;
  permissionValidated: boolean;
  tokenExpiresAt: string | null;
  rateLimited: boolean;
  replayProtected: boolean;
  nonce: string | null;
};

export type RealtimeVersionLock = {
  realtime_version: typeof REALTIME_VERSION;
  voice_gateway_version: typeof REALTIME_VOICE_GATEWAY_VERSION;
  avatar_version: typeof REALTIME_AVATAR_VERSION;
  streaming_version: typeof REALTIME_STREAMING_VERSION;
  computed_at: string;
};

export type RealtimeBundle = {
  version: RealtimeVersionLock;
  session: SessionExperienceState;
  personality: VoicePersonalityProfile | null;
  avatar: AvatarPose;
  nonverbal: NonverbalPresentation;
  multilingual: MultilingualSessionState;
  accessibility: AccessibilityControls;
  security: RealtimeSecurityContext;
  quality: QualityAdaptationDecision;
  metrics: RealtimeMetricEvent[];
  ownership: string;
};

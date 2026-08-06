/**
 * Hands-Free Therapy Engine (HFTE) — conversation UX types only.
 * Does not alter clinical reasoning, PME, TRE, ACE, or scoring.
 */

export type ConversationState =
  | "Listening"
  | "Processing"
  | "AvatarSpeaking"
  | "Paused"
  | "Finished";

/** UI-facing status for the session status bar (may refine ConversationState). */
export type SessionStatusKind =
  | "listening"
  | "thinking"
  | "patientSpeaking"
  | "paused"
  | "networkRetry"
  | "microphoneMuted"
  | "connectionLost"
  | "ready"
  | "finished";

export type ConversationMode = "push_to_talk" | "hands_free";

export type VoiceConversationPreferences = {
  mode: ConversationMode;
  autoInterrupt: boolean;
  /** Multiplier on base thinking delay (0.5–2). */
  thinkingDelayScale: number;
  showWaveform: boolean;
  /**
   * VAD sensitivity 0–1 (higher = more sensitive / lower speech threshold).
   * Maps onto energy thresholds.
   */
  voiceSensitivity: number;
  /** Minimum silence after speech before turn end (ms). Clamped 600–900. */
  minSilenceMs: number;
  /** When true, pause freezes the displayed session timer. */
  freezeTimerWhenPaused: boolean;
  muteAvatar: boolean;
};

export const DEFAULT_VOICE_PREFERENCES: VoiceConversationPreferences = {
  mode: "hands_free",
  autoInterrupt: true,
  thinkingDelayScale: 1,
  showWaveform: true,
  voiceSensitivity: 0.55,
  minSilenceMs: 750,
  freezeTimerWhenPaused: true,
  muteAvatar: false,
};

/** Aggregate metrics for a session — never includes audio. */
export type HfteSessionMetrics = {
  sessionId: string;
  interruptionCount: number;
  pauseCount: number;
  /** Sum of therapist speech durations (ms). */
  speechDurationMs: number;
  /** Sum of avatar thinking delays applied (ms). */
  thinkingLatencyMs: number;
  turnCount: number;
  /** Mean VAD confidence 0–1 across finalized turns. */
  vadConfidenceSum: number;
  vadConfidenceSamples: number;
  networkDisconnectCount: number;
};

export type HfteTurnMetricSample = {
  speechDurationMs: number;
  thinkingLatencyMs: number;
  interrupted: boolean;
  vadConfidence: number;
};

/** Lightweight PME-compatible cue surface for UX vocalization / delay only. */
export type PmeUxCues = {
  diagnosisSlug?: string | null;
  disorderCategory?: string | null;
  severity?: "subclinical" | "mild" | "moderate" | "severe" | null;
  pace?: "slow" | "measured" | "fast" | "variable" | "pressured" | null;
  energy?: "low" | "moderate" | "high" | "labile" | null;
  /** 0–1 alliance / rapport proxy when available. */
  alliance?: number | null;
  /** 0–1 confidence / certainty proxy when available. */
  confidence?: number | null;
  hesitation?: number | null;
  emotion?: string | null;
  /** Whether vocalization prefixes are clinically appropriate. */
  permitsVocalization: boolean;
};

export type VocalizationKind =
  | "hmm"
  | "i_dont_know"
  | "long_sigh"
  | "breathing"
  | "crying"
  | "voice_tremor"
  | "nervous_laugh"
  | "long_pause"
  | null;

export type VadFrameResult = {
  isSpeech: boolean;
  energy: number;
  /** 0–1 spectral flatness (higher ≈ noise-like). */
  flatness: number;
  /** Rejected as non-speech transient (click/keyboard). */
  rejectedTransient: boolean;
  confidence: number;
  clipping: boolean;
};

export type VadEvent =
  | { type: "speech_start"; confidence: number }
  | { type: "speech_end"; confidence: number; durationMs: number }
  | { type: "interruption"; confidence: number }
  | { type: "noise"; energy: number };

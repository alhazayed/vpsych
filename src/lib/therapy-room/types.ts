/**
 * Therapy Room Mode (TRM) — shared domain types.
 * Future 3D / VR renderers consume the same scene + behavior contracts.
 */

export type InteractionMode = "classic" | "therapy_room";

export type TherapyRoomThemeId =
  | "modern_clinic"
  | "academic_hospital"
  | "community_mental_health"
  | "private_practice"
  | "child_psychiatry"
  | "emergency_psychiatry";

export type PatientAffect =
  | "neutral"
  | "anxious"
  | "depressed"
  | "irritable"
  | "euphoric"
  | "guarded"
  | "tearful"
  | "agitated"
  | "flat"
  | "labile";

/** Discrete nonverbal cues — every cue must originate from PME bridge, never RNG. */
export type NonverbalCue =
  | "idle_breathing"
  | "blink"
  | "look_away"
  | "eye_contact"
  | "fidget"
  | "posture_shift"
  | "sigh"
  | "tears"
  | "laughter"
  | "silence"
  | "cross_arms"
  | "head_down"
  | "restlessness"
  | "hand_tremor"
  | "slow_movements"
  | "psychomotor_agitation"
  | "psychomotor_retardation";

export type PatientPresencePhase =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "silent";

export type RoomAmbienceKind =
  | "hvac"
  | "chair"
  | "paper"
  | "clock"
  | "silence";

export type TherapyRoomTheme = {
  id: TherapyRoomThemeId;
  labelKey: string;
  /** CSS custom-property overrides for the 2D room (3D maps onto same ids). */
  cssVars: Record<string, string>;
  defaultAmbience: RoomAmbienceKind;
};

/** PME-compatible patient behavior packet for the room renderer. */
export type PatientBehaviorState = {
  disorderSlug: string;
  affect: PatientAffect;
  phase: PatientPresencePhase;
  activeCues: NonverbalCue[];
  /** Thinking latency before first spoken token (ms). */
  thinkingLatencyMs: number;
  /** TTS / playback modulation. */
  voice: VoiceModulation;
  /** Whether this presentation may interrupt the therapist. */
  mayInterruptTherapist: boolean;
  interruptProbability: number;
  /** Future animation hooks — stable string ids for 3D/rig systems. */
  animationHooks: string[];
};

export type VoiceModulation = {
  rate: number;
  volume: number;
  pitch: number;
  pauseScale: number;
  emotion: PatientAffect;
};

export type ImmersionEventKind =
  | "hands_free_turn"
  | "manual_mic_turn"
  | "text_turn"
  | "transcript_opened"
  | "transcript_closed"
  | "pause"
  | "resume"
  | "therapist_interrupt"
  | "patient_interrupt"
  | "control_open"
  | "notes_open"
  | "settings_open"
  | "session_start"
  | "session_end";

export type ImmersionEvent = {
  kind: ImmersionEventKind;
  at: number;
};

/**
 * Therapy Room Immersion Index (TRII) — 0–100.
 * Higher = more immersive (less UI distraction, more hands-free continuity).
 */
export type TherapyRoomImmersionIndex = {
  overall: number;
  interfaceDistraction: number;
  conversationContinuity: number;
  handsFreeUsage: number;
  interruptionFrequency: number;
  transcriptDependency: number;
  userImmersion: number;
  eventCounts: Record<string, number>;
};

export type TherapyRoomSettings = {
  themeId: TherapyRoomThemeId;
  showLiveTranscript: boolean;
  showTimer: boolean;
  timerMode: "elapsed" | "remaining";
  muteAvatar: boolean;
  ambienceEnabled: boolean;
  ambienceVolume: number;
};

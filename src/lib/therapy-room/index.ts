/**
 * Therapy room barrel — Therapy Room Mode (TRM) + Virtual Mental Health Center (VMHC).
 *
 * TRM: optional immersive consultation room on /sessions/[id]
 *      (NEXT_PUBLIC_THERAPY_ROOM_MODE).
 * VMHC: clinic-day workflow on /clinic (FEATURE_THERAPY_ROOM).
 * Classic VoiceSession remains the default when flags are off.
 */

export { isTherapyRoomEnabled } from "@/lib/features";

export type {
  InteractionMode,
  TherapyRoomThemeId,
  TherapyRoomTheme,
  PatientAffect,
  NonverbalCue,
  PatientPresencePhase,
  PatientBehaviorState,
  VoiceModulation,
  ImmersionEvent,
  ImmersionEventKind,
  TherapyRoomImmersionIndex,
  TherapyRoomSettings,
  RoomAmbienceKind,
  NoteFormat,
  ClinicUrgency,
  AppointmentStatus,
  RoomPhase,
  TherapyRoomToolbarAction,
  ChartSectionId,
  PatientNonverbalProfile,
  ClinicAppointmentCard,
  PreSessionChart,
  PrivateNoteEntry,
  ArrivalBeat,
  DepartureBeat,
  SupervisorBriefing,
  DailyClinicSummary,
  ClinicImmersionChannel,
  ClinicImmersionEvent,
  ClinicImmersionAdapter,
  ImmersionChannel,
  ImmersionAdapter,
} from "./types";

export {
  isTherapyRoomModeEnabled,
  parseInteractionMode,
  shouldUseTherapyRoom,
} from "./feature-flag";

export {
  THERAPY_ROOM_THEMES,
  DEFAULT_THERAPY_ROOM_THEME,
  resolveTherapyRoomTheme,
  allTherapyRoomThemeIds,
} from "./themes";

export {
  derivePatientBehavior,
  thinkingLatencyMs,
  deterministicJitter,
} from "./pme-bridge";

export {
  shouldPatientInterruptTherapist,
  INTERRUPTIVE_DISORDER_HINTS,
} from "./interruption";

export {
  voiceModulationForDisorder,
  applyBrowserVoiceModulation,
  applyHtmlAudioModulation,
} from "./voice-modulation";

export {
  computeImmersionIndex,
  createImmersionTracker,
  type ImmersionTracker,
} from "./immersion-index";

export {
  startHandsFreeVad,
  startBargeInMonitor,
  evaluateVadFrame,
  resolveSilenceMs,
  rms,
  type VadController,
  type HandsFreeVadOptions,
} from "./vad";

export {
  resolveTurnTakingConfig,
  TURN_TAKING_DEFAULTS,
  endpointCommitSilenceMs,
  resolveEndpointInitialMs,
  type TurnTakingConfig,
} from "./turn-taking-config";

export {
  HANDS_FREE_AUDIO_CONSTRAINTS,
  BARGE_IN_AUDIO_CONSTRAINTS,
} from "./audio-constraints";

export {
  canTransition,
  nextConversationState,
  transition,
  createConversationFsm,
  micAllowed,
  playbackAllowed,
  listenLoopBlocked,
  statusKeyForState,
  listLegalTransitions,
  type ConversationState,
  type ConversationEvent,
  type ConversationStatusKey,
  type ConversationFsm,
  type TransitionResult,
} from "./conversation-fsm";

export {
  createConversationTelemetry,
  HANDS_FREE_PERF_BUDGETS,
  getHandsFreePerfBudgets,
  type ConversationTelemetry,
  type ConversationTelemetryKind,
  type ConversationTelemetryEvent,
  type ConversationTelemetrySummary,
} from "./conversation-telemetry";

export { startRoomAmbience, type AmbienceController } from "./ambience";

export * from "./chart-visibility";
export * from "./patient-behavior";
export * from "./arrival";
export * from "./immersion";
export * from "./clinic-schedule";
export * from "./chart";
export * from "./supervisor";
export * from "./daily-summary";
export * from "./notes";
export * from "./close-day";

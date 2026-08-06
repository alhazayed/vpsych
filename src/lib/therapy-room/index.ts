/**
 * Canonical Therapy Room barrel (Mission 34 + 35 consolidated).
 *
 * Single flag: NEXT_PUBLIC_THERAPY_ROOM_MODE
 * Single mode: sessions.interaction_mode
 * Single room UI: TherapyRoomSession on /sessions/[id]
 * Clinic day workflow: /clinic (schedule → chart → invite → same room)
 * Classic VoiceSession remains the default when the flag is off.
 */

export {
  isTherapyRoomModeEnabled,
  parseInteractionMode,
  shouldUseTherapyRoom,
} from "./feature-flag";

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
} from "./types";

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
  type VadController,
  type HandsFreeVadOptions,
} from "./vad";

export { startRoomAmbience, type AmbienceController } from "./ambience";

export * from "./chart-visibility";
export * from "./patient-behavior";
export * from "./arrival";
export * from "./clinic-schedule";
export * from "./chart";
export * from "./supervisor";
export * from "./daily-summary";
export * from "./notes";
export * from "./close-day";

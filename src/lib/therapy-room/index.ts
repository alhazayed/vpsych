/**
 * Therapy Room Mode (TRM) — immersive psychiatric consultation room.
 *
 * Optional behind NEXT_PUBLIC_THERAPY_ROOM_MODE. Classic VoiceSession remains default.
 * See docs/THERAPY_ROOM_MODE.md.
 */

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
  type VadController,
  type HandsFreeVadOptions,
} from "./vad";

export { startRoomAmbience, type AmbienceController } from "./ambience";

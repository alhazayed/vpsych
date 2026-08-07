/**
 * Session Experience — waiting room, monitors, pause/resume, emergency stop.
 */

import type {
  ConnectionState,
  NetworkQuality,
  SessionExperienceState,
  TurnPhase,
  VoiceGatewayState,
} from "@/lib/realtime/types";
import { MAX_SESSION_SECONDS } from "@/lib/types";

export function createInitialSessionExperience(opts?: {
  remainingSec?: number;
  waitingRoom?: boolean;
}): SessionExperienceState {
  const remaining = opts?.remainingSec ?? MAX_SESSION_SECONDS;
  return {
    connection: "idle",
    voiceGateway: "idle",
    turn: "waiting",
    network: "good",
    latencyMs: null,
    voiceQuality: 0.9,
    reconnectAttempt: 0,
    sessionElapsedSec: 0,
    sessionRemainingSec: remaining,
    paused: false,
    captionsEnabled: true,
    transcriptMode: false,
    waitingRoom: opts?.waitingRoom ?? true,
    emergencyTermination: false,
  };
}

export function enterSessionFloor(
  state: SessionExperienceState,
): SessionExperienceState {
  return {
    ...state,
    waitingRoom: false,
    connection: "connected",
    voiceGateway: "listening",
  };
}

export function patchConnection(
  state: SessionExperienceState,
  connection: ConnectionState,
  reconnectAttempt = state.reconnectAttempt,
): SessionExperienceState {
  return { ...state, connection, reconnectAttempt };
}

export function patchVoiceGateway(
  state: SessionExperienceState,
  voiceGateway: VoiceGatewayState,
  turn?: TurnPhase,
): SessionExperienceState {
  return {
    ...state,
    voiceGateway,
    ...(turn ? { turn } : {}),
  };
}

export function patchNetwork(
  state: SessionExperienceState,
  network: NetworkQuality,
  latencyMs: number | null,
  voiceQuality?: number,
): SessionExperienceState {
  return {
    ...state,
    network,
    latencyMs,
    voiceQuality: voiceQuality ?? state.voiceQuality,
  };
}

export function tickSessionTimer(
  state: SessionExperienceState,
  startedAtIso: string,
  maxDurationSec = MAX_SESSION_SECONDS,
  now = Date.now(),
): SessionExperienceState {
  const started = new Date(startedAtIso).getTime();
  const elapsed = Math.max(0, Math.floor((now - started) / 1000));
  const remaining = Math.max(0, maxDurationSec - elapsed);
  return {
    ...state,
    sessionElapsedSec: elapsed,
    sessionRemainingSec: remaining,
  };
}

export function pauseSession(
  state: SessionExperienceState,
): SessionExperienceState {
  return {
    ...state,
    paused: true,
    turn: "paused",
    voiceGateway: "idle",
    connection: "paused",
  };
}

export function resumeSession(
  state: SessionExperienceState,
): SessionExperienceState {
  return {
    ...state,
    paused: false,
    connection: "connected",
    voiceGateway: "listening",
    turn: "waiting",
  };
}

export function emergencyTerminate(
  state: SessionExperienceState,
): SessionExperienceState {
  return {
    ...state,
    emergencyTermination: true,
    paused: true,
    connection: "terminated",
    voiceGateway: "error",
    turn: "paused",
  };
}

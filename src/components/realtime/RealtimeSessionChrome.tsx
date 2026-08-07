"use client";

/**
 * Stage 11 — session experience chrome (waiting room / monitors / a11y).
 * Presentation only; does not own patient cognition.
 */

import { useEffect, useState } from "react";
import type { SessionExperienceState } from "@/lib/realtime/types";
import { REALTIME_KEYBOARD_SHORTCUTS } from "@/lib/realtime/accessibility";
import {
  createInitialSessionExperience,
  enterSessionFloor,
  emergencyTerminate,
  pauseSession,
  resumeSession,
  tickSessionTimer,
} from "@/lib/realtime/session-experience";

type Props = {
  sessionId: string;
  startedAt: string;
  maxDurationSec?: number;
  locale?: "en" | "ar";
  onEmergencyEnd?: () => void;
};

export function RealtimeSessionChrome({
  sessionId,
  startedAt,
  maxDurationSec,
  locale = "en",
  onEmergencyEnd,
}: Props) {
  const [state, setState] = useState<SessionExperienceState>(() =>
    createInitialSessionExperience({ waitingRoom: true }),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((prev) =>
        tickSessionTimer(prev, startedAt, maxDurationSec),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, maxDurationSec]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === REALTIME_KEYBOARD_SHORTCUTS.pauseResume) {
        e.preventDefault();
        setState((prev) => (prev.paused ? resumeSession(prev) : pauseSession(prev)));
      }
      if (e.code === REALTIME_KEYBOARD_SHORTCUTS.emergencyEnd) {
        e.preventDefault();
        setState((prev) => emergencyTerminate(prev));
        onEmergencyEnd?.();
      }
      if (e.code === REALTIME_KEYBOARD_SHORTCUTS.toggleCaptions) {
        setState((prev) => ({
          ...prev,
          captionsEnabled: !prev.captionsEnabled,
        }));
      }
      if (e.code === REALTIME_KEYBOARD_SHORTCUTS.toggleTranscript) {
        setState((prev) => ({
          ...prev,
          transcriptMode: !prev.transcriptMode,
        }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEmergencyEnd]);

  const dir = locale === "ar" ? "rtl" : "ltr";

  if (state.waitingRoom) {
    return (
      <section
        className="realtime-waiting-room"
        data-realtime-session={sessionId}
        dir={dir}
        aria-label="Waiting room"
      >
        <h2>Waiting room</h2>
        <p>Checking connection and microphone permissions…</p>
        <button
          type="button"
          onClick={() => setState((prev) => enterSessionFloor(prev))}
        >
          Enter session
        </button>
      </section>
    );
  }

  return (
    <section
      className="realtime-session-chrome"
      data-realtime-session={sessionId}
      data-connection={state.connection}
      data-network={state.network}
      dir={dir}
      aria-live="polite"
    >
      <div className="realtime-monitors" role="status">
        <span data-testid="connection-monitor">
          Connection: {state.connection}
        </span>
        <span data-testid="latency-indicator">
          Latency: {state.latencyMs ?? "—"} ms
        </span>
        <span data-testid="voice-quality">
          Voice quality: {Math.round(state.voiceQuality * 100)}%
        </span>
        <span data-testid="network-quality">Network: {state.network}</span>
        <span data-testid="reconnect-status">
          Reconnects: {state.reconnectAttempt}
        </span>
        <span data-testid="session-timer">
          {formatTime(state.sessionElapsedSec)} / remaining{" "}
          {formatTime(state.sessionRemainingSec)}
        </span>
      </div>
      <div className="realtime-controls">
        <button
          type="button"
          onClick={() =>
            setState((prev) =>
              prev.paused ? resumeSession(prev) : pauseSession(prev),
            )
          }
        >
          {state.paused ? "Resume" : "Pause"}
        </button>
        <button
          type="button"
          onClick={() => {
            setState((prev) => emergencyTerminate(prev));
            onEmergencyEnd?.();
          }}
        >
          End session
        </button>
        <label>
          <input
            type="checkbox"
            checked={state.captionsEnabled}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                captionsEnabled: e.target.checked,
              }))
            }
          />
          Captions
        </label>
        <label>
          <input
            type="checkbox"
            checked={state.transcriptMode}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                transcriptMode: e.target.checked,
              }))
            }
          />
          Transcript mode
        </label>
      </div>
      {state.emergencyTermination ? (
        <p role="alert">Session terminated.</p>
      ) : null}
    </section>
  );
}

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

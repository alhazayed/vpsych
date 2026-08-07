/**
 * Reconnect Logic — exponential backoff with jitter and circuit break.
 */

import type { ConnectionState } from "@/lib/realtime/types";

export type ReconnectOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export type ReconnectPlan = {
  attempt: number;
  delayMs: number;
  shouldRetry: boolean;
  nextState: ConnectionState;
};

export function createReconnectController(opts: ReconnectOptions = {}) {
  const maxAttempts = opts.maxAttempts ?? 6;
  const baseDelayMs = opts.baseDelayMs ?? 400;
  const maxDelayMs = opts.maxDelayMs ?? 12_000;
  let attempt = 0;

  return {
    onDisconnect(): ReconnectPlan {
      attempt += 1;
      if (attempt > maxAttempts) {
        return {
          attempt,
          delayMs: 0,
          shouldRetry: false,
          nextState: "error",
        };
      }
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * Math.min(250, exp * 0.2));
      return {
        attempt,
        delayMs: exp + jitter,
        shouldRetry: true,
        nextState: "reconnecting",
      };
    },
    onConnected() {
      attempt = 0;
    },
    reset() {
      attempt = 0;
    },
    attempt() {
      return attempt;
    },
  };
}

export function connectionAfterReconnect(ok: boolean): ConnectionState {
  return ok ? "connected" : "degraded";
}

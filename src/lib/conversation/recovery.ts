/**
 * Network recovery helpers for HFTE.
 * Ensures reconnect does not duplicate therapist messages.
 */

export type NetworkStatus = "online" | "offline" | "reconnecting";

export type PendingTurnGuard = {
  /** Dedup key for the last successfully submitted therapist transcript. */
  lastSubmittedKey: string | null;
  /** In-flight turn key (cleared on success or abort). */
  inFlightKey: string | null;
};

export function createPendingTurnGuard(): PendingTurnGuard {
  return { lastSubmittedKey: null, inFlightKey: null };
}

export function turnDedupKey(transcript: string): string {
  return transcript.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Returns whether this transcript may be submitted.
 * Blocks duplicates of the last success and concurrent identical in-flight turns.
 */
export function canSubmitTranscript(
  guard: PendingTurnGuard,
  transcript: string,
): boolean {
  const key = turnDedupKey(transcript);
  if (!key) return false;
  if (guard.inFlightKey === key) return false;
  if (guard.lastSubmittedKey === key) return false;
  return true;
}

export function markTurnInFlight(
  guard: PendingTurnGuard,
  transcript: string,
): PendingTurnGuard {
  return { ...guard, inFlightKey: turnDedupKey(transcript) };
}

export function markTurnSucceeded(
  guard: PendingTurnGuard,
  transcript: string,
): PendingTurnGuard {
  const key = turnDedupKey(transcript);
  return { lastSubmittedKey: key, inFlightKey: null };
}

export function markTurnFailed(guard: PendingTurnGuard): PendingTurnGuard {
  return { ...guard, inFlightKey: null };
}

export function initialNetworkStatus(
  online: boolean | undefined = typeof navigator !== "undefined"
    ? navigator.onLine
    : true,
): NetworkStatus {
  return online === false ? "offline" : "online";
}

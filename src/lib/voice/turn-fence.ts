/**
 * Client-side voice turn fencing (Phase 9.1).
 *
 * Each conversational voice turn gets a monotonic turn_id. When a newer turn
 * begins (or the session invalidates in-flight work), late async results from
 * older turns must be ignored — even if their individual AbortSignal did not
 * fire (e.g. a fetch that already resolved).
 *
 * Presentation / transport only. Does not own clinical cognition or persistence.
 */

export type VoiceTurnId = number;

export type VoiceTurnFence = {
  /** Start a new turn; supersedes any prior turn. Returns the new turn_id. */
  beginTurn: () => VoiceTurnId;
  /** Invalidate the active turn without starting replacement work (end/unmount). */
  invalidate: () => void;
  /** True iff turnId is still the active turn. */
  isActive: (turnId: VoiceTurnId) => boolean;
  getActiveTurnId: () => VoiceTurnId;
};

export function createVoiceTurnFence(
  initialTurnId: VoiceTurnId = 0,
): VoiceTurnFence {
  let activeTurnId = initialTurnId;

  return {
    beginTurn() {
      activeTurnId += 1;
      return activeTurnId;
    },
    invalidate() {
      activeTurnId += 1;
    },
    isActive(turnId) {
      return turnId > 0 && turnId === activeTurnId;
    },
    getActiveTurnId() {
      return activeTurnId;
    },
  };
}

/**
 * True when an async voice result must be dropped.
 * Stale if the turn was superseded OR the request signal aborted.
 */
export function isStaleVoiceResult(params: {
  turnId: VoiceTurnId;
  isActive: (turnId: VoiceTurnId) => boolean;
  signal?: AbortSignal;
}): boolean {
  if (params.signal?.aborted) return true;
  return !params.isActive(params.turnId);
}

/** Detect AbortError from fetch / DOM without relying on instanceof alone. */
export function isAbortError(error: unknown): boolean {
  if (error == null) return false;
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }
  if (error instanceof Error) {
    return error.name === "AbortError" || /aborted/i.test(error.message);
  }
  return false;
}

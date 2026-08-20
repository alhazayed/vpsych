/**
 * Single-response turn guard for the therapist → patient conversation loop.
 *
 * INVARIANT: one completed therapist turn === exactly one patient response.
 *
 * Why this exists as a plain module rather than React state:
 * `VoiceSession` installs its SpeechRecognition handlers once, so those
 * callbacks close over the `sendMessage` (and therefore the `pending` flag)
 * that existed at install time. A `setPending(true)` inside the first callback
 * does not update the value the *second* callback sees, so a React-state guard
 * cannot stop two finals that arrive before a re-render. This guard is
 * synchronous and ref-held, so the decision is made on the current value every
 * time, with no closure staleness and no dependency on render timing.
 *
 * It changes no clinical content, no transcript text, no TTS payload, and no
 * persistence semantics. It only decides whether a turn is allowed to start.
 */

export type TurnRejectionReason =
  | "empty_transcript"
  | "turn_in_flight"
  | "duplicate_transcript";

export type BeginTurnResult =
  | { accepted: true; turnId: number }
  | { accepted: false; reason: TurnRejectionReason };

export type TurnGuard = {
  /**
   * Open a new listening window. Clears duplicate-detection history so a
   * therapist may legitimately repeat the same sentence in a later turn.
   */
  beginListening: () => void;
  /** Attempt to start a turn. Rejects duplicates and concurrent turns. */
  beginTurn: (transcript: string) => BeginTurnResult;
  /** True while `turnId` is still the turn that owns the conversation. */
  isCurrent: (turnId: number) => boolean;
  /**
   * Finish a turn. Returns false when the turn was superseded or cancelled,
   * in which case its result must be discarded (no message, no playback).
   */
  completeTurn: (turnId: number) => boolean;
  /** Abandon the in-flight turn (barge-in, pause, session end). */
  cancelActive: () => void;
  /** Full reset — used on unmount. */
  reset: () => void;
  /** Introspection for tests and status UI. */
  activeTurnId: () => number | null;
};

/** Collapse whitespace so trivial spacing differences are not "new" text. */
function canonical(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

/**
 * A second final result that merely extends the one already sent is the same
 * utterance, not a new one. Web Speech rebuilds `event.results` from index 0,
 * so a follow-up final commonly arrives as `previous + more`.
 */
function isSameUtterance(previous: string, next: string): boolean {
  if (!previous) return false;
  return next === previous || next.startsWith(previous);
}

export function createTurnGuard(): TurnGuard {
  let nextTurnId = 1;
  let activeTurn: number | null = null;
  let lastAcceptedInWindow = "";

  return {
    beginListening() {
      lastAcceptedInWindow = "";
    },

    beginTurn(transcript: string): BeginTurnResult {
      const text = canonical(transcript);
      if (!text) return { accepted: false, reason: "empty_transcript" };

      // One turn at a time — this is the single-response invariant.
      if (activeTurn !== null) {
        return { accepted: false, reason: "turn_in_flight" };
      }

      if (isSameUtterance(lastAcceptedInWindow, text)) {
        return { accepted: false, reason: "duplicate_transcript" };
      }

      const turnId = nextTurnId++;
      activeTurn = turnId;
      lastAcceptedInWindow = text;
      return { accepted: true, turnId };
    },

    isCurrent(turnId: number) {
      return activeTurn === turnId;
    },

    completeTurn(turnId: number) {
      if (activeTurn !== turnId) return false;
      activeTurn = null;
      return true;
    },

    cancelActive() {
      activeTurn = null;
    },

    reset() {
      activeTurn = null;
      lastAcceptedInWindow = "";
    },

    activeTurnId() {
      return activeTurn;
    },
  };
}

/**
 * Explicit finite state machine for hands-free Therapy Room conversation.
 *
 * Only listed transitions are legal. Invalid events are rejected (no-op with
 * reason) so callers never race into overlapping mic / STT / TTS work.
 */

export type ConversationState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING_STT"
  | "WAITING_GPT"
  | "AVATAR_SPEAKING"
  | "PAUSED"
  | "ERROR";

export type ConversationEvent =
  | "START"
  | "SPEECH_END"
  | "STT_OK"
  | "STT_EMPTY"
  | "STT_FAIL"
  | "GPT_OK"
  | "GPT_FAIL"
  | "PLAYBACK_END"
  | "BARGE_IN"
  | "PAUSE"
  | "RESUME"
  | "ERROR"
  | "RETRY"
  | "END";

/** Human-readable status keys — map to therapyRoom.status.* i18n. */
export type ConversationStatusKey =
  | "ready"
  | "listening"
  | "processingStt"
  | "thinking"
  | "avatarSpeaking"
  | "paused"
  | "reconnecting"
  | "error"
  | "ending";

const TRANSITIONS: Record<
  ConversationState,
  Partial<Record<ConversationEvent, ConversationState>>
> = {
  IDLE: {
    START: "LISTENING",
    END: "IDLE",
  },
  LISTENING: {
    SPEECH_END: "PROCESSING_STT",
    PAUSE: "PAUSED",
    ERROR: "ERROR",
    END: "IDLE",
  },
  PROCESSING_STT: {
    STT_OK: "WAITING_GPT",
    STT_EMPTY: "LISTENING",
    STT_FAIL: "ERROR",
    ERROR: "ERROR",
    PAUSE: "PAUSED",
    END: "IDLE",
  },
  WAITING_GPT: {
    GPT_OK: "AVATAR_SPEAKING",
    GPT_FAIL: "ERROR",
    ERROR: "ERROR",
    PAUSE: "PAUSED",
    END: "IDLE",
  },
  AVATAR_SPEAKING: {
    PLAYBACK_END: "LISTENING",
    BARGE_IN: "LISTENING",
    PAUSE: "PAUSED",
    ERROR: "ERROR",
    END: "IDLE",
  },
  PAUSED: {
    RESUME: "LISTENING",
    END: "IDLE",
  },
  ERROR: {
    RETRY: "LISTENING",
    PAUSE: "PAUSED",
    END: "IDLE",
  },
};

export type TransitionResult =
  | {
      ok: true;
      from: ConversationState;
      to: ConversationState;
      event: ConversationEvent;
    }
  | {
      ok: false;
      from: ConversationState;
      event: ConversationEvent;
      reason: "invalid_transition";
    };

export function canTransition(
  from: ConversationState,
  event: ConversationEvent,
): boolean {
  return TRANSITIONS[from][event] !== undefined;
}

export function nextConversationState(
  from: ConversationState,
  event: ConversationEvent,
): ConversationState | null {
  return TRANSITIONS[from][event] ?? null;
}

export function transition(
  from: ConversationState,
  event: ConversationEvent,
): TransitionResult {
  const to = nextConversationState(from, event);
  if (!to) {
    return { ok: false, from, event, reason: "invalid_transition" };
  }
  return { ok: true, from, to, event };
}

/** States where the therapist microphone may be open. */
export function micAllowed(state: ConversationState): boolean {
  return state === "LISTENING";
}

/** States where avatar TTS may play. */
export function playbackAllowed(state: ConversationState): boolean {
  return state === "AVATAR_SPEAKING";
}

/** States that block starting a new listen loop. */
export function listenLoopBlocked(state: ConversationState): boolean {
  return (
    state === "PROCESSING_STT" ||
    state === "WAITING_GPT" ||
    state === "AVATAR_SPEAKING" ||
    state === "PAUSED" ||
    state === "IDLE"
  );
}

export function statusKeyForState(
  state: ConversationState,
  opts?: { reconnecting?: boolean; ending?: boolean },
): ConversationStatusKey {
  if (opts?.ending) return "ending";
  if (opts?.reconnecting) return "reconnecting";
  switch (state) {
    case "IDLE":
      return "ready";
    case "LISTENING":
      return "listening";
    case "PROCESSING_STT":
      return "processingStt";
    case "WAITING_GPT":
      return "thinking";
    case "AVATAR_SPEAKING":
      return "avatarSpeaking";
    case "PAUSED":
      return "paused";
    case "ERROR":
      return "error";
  }
}

/**
 * Mutable FSM handle — generation counter rejects stale async completions.
 */
export function createConversationFsm(
  initial: ConversationState = "IDLE",
): {
  getState: () => ConversationState;
  getGeneration: () => number;
  dispatch: (event: ConversationEvent) => TransitionResult;
  /** Bump generation and force state (cleanup / unmount). */
  reset: (state?: ConversationState) => void;
  /** True if this generation still owns the conversation. */
  isCurrent: (generation: number) => boolean;
} {
  let state: ConversationState = initial;
  let generation = 0;

  return {
    getState: () => state,
    getGeneration: () => generation,
    dispatch(event) {
      const result = transition(state, event);
      if (result.ok) {
        state = result.to;
        if (
          event === "START" ||
          event === "RESUME" ||
          event === "RETRY" ||
          event === "BARGE_IN" ||
          event === "END" ||
          event === "PAUSE"
        ) {
          generation += 1;
        }
      }
      return result;
    },
    reset(next: ConversationState = "IDLE") {
      state = next;
      generation += 1;
    },
    isCurrent(gen) {
      return gen === generation;
    },
  };
}

export type ConversationFsm = ReturnType<typeof createConversationFsm>;

/** Exhaustive list of legal edges — used by tests and docs. */
export function listLegalTransitions(): Array<{
  from: ConversationState;
  event: ConversationEvent;
  to: ConversationState;
}> {
  const edges: Array<{
    from: ConversationState;
    event: ConversationEvent;
    to: ConversationState;
  }> = [];
  for (const from of Object.keys(TRANSITIONS) as ConversationState[]) {
    const map = TRANSITIONS[from];
    for (const event of Object.keys(map) as ConversationEvent[]) {
      const to = map[event];
      if (to) edges.push({ from, event, to });
    }
  }
  return edges;
}

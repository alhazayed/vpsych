/**
 * Shared turn-taking controller.
 *
 * One state model for both the classic Voice Session and Therapy Room, so the
 * rule "the patient waits until the therapist has actually finished" is
 * implemented once instead of twice.
 *
 *   LISTENING ──speech──► USER_SPEAKING ──silence──► POSSIBLE_END
 *                              ▲                        │
 *                              └────speech resumes──────┘
 *                                                       │ confirmed silence
 *                                                       ▼
 *   LISTENING ◄──playback done/barge-in── SPEAKING ◄─ THINKING ◄─ CONFIRMED_END
 *
 * Two properties this module exists to guarantee:
 *
 * 1. A turn can only be generated from CONFIRMED_END. A partial or interim
 *    transcript is not an input to this controller at all, so partial STT can
 *    never advance the state machine or trigger a patient reply.
 * 2. POSSIBLE_END is reversible. A therapist who pauses mid-sentence returns to
 *    USER_SPEAKING instead of having their turn cut.
 */

export type TurnState =
  | "LISTENING"
  | "USER_SPEAKING"
  | "POSSIBLE_END"
  | "CONFIRMED_END"
  | "THINKING"
  | "SPEAKING";

export type TurnTransitionReason =
  | "speech_started"
  | "speech_resumed"
  | "silence_possible_end"
  | "silence_confirmed"
  | "max_turn_reached"
  | "confirmed"
  | "playback_started"
  | "playback_ended"
  | "barge_in"
  | "reset";

export type TurnControllerConfig = {
  /** Silence after speech before entering POSSIBLE_END. */
  possibleEndSilenceMs: number;
  /**
   * Additional silence required inside POSSIBLE_END before the turn is
   * confirmed. Total end-of-turn latency is possibleEnd + confirm.
   */
  confirmEndSilenceMs: number;
  /** Accumulated speech required before a turn may confirm at all. */
  minSpeechMs: number;
  /** Hard ceiling on a single therapist turn. */
  maxTurnMs: number;
};

/**
 * Defaults deliberately tolerate normal clinical pauses.
 *
 * The previous hands-free implementation cut the turn at a hard-clamped 850 ms
 * of silence, which is inside the range of an ordinary thinking pause. These
 * defaults cost +350 ms of end-of-turn latency (850 → 1200 ms) and in exchange
 * tolerate any pause shorter than 1200 ms without ending the therapist's turn.
 * `resolveTurnConfig` allows tuning per locale/deployment.
 */
export const DEFAULT_TURN_CONFIG: TurnControllerConfig = {
  possibleEndSilenceMs: 500,
  confirmEndSilenceMs: 700,
  minSpeechMs: 400,
  maxTurnMs: 28_000,
};

/** Bounds keep any caller-supplied override inside a usable range. */
export const TURN_CONFIG_BOUNDS = {
  possibleEndSilenceMs: { min: 200, max: 1500 },
  confirmEndSilenceMs: { min: 200, max: 2500 },
  minSpeechMs: { min: 100, max: 2000 },
  maxTurnMs: { min: 5_000, max: 120_000 },
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function resolveTurnConfig(
  overrides: Partial<TurnControllerConfig> = {},
): TurnControllerConfig {
  const merged = { ...DEFAULT_TURN_CONFIG, ...overrides };
  return {
    possibleEndSilenceMs: clamp(
      merged.possibleEndSilenceMs,
      TURN_CONFIG_BOUNDS.possibleEndSilenceMs.min,
      TURN_CONFIG_BOUNDS.possibleEndSilenceMs.max,
    ),
    confirmEndSilenceMs: clamp(
      merged.confirmEndSilenceMs,
      TURN_CONFIG_BOUNDS.confirmEndSilenceMs.min,
      TURN_CONFIG_BOUNDS.confirmEndSilenceMs.max,
    ),
    minSpeechMs: clamp(
      merged.minSpeechMs,
      TURN_CONFIG_BOUNDS.minSpeechMs.min,
      TURN_CONFIG_BOUNDS.minSpeechMs.max,
    ),
    maxTurnMs: clamp(
      merged.maxTurnMs,
      TURN_CONFIG_BOUNDS.maxTurnMs.min,
      TURN_CONFIG_BOUNDS.maxTurnMs.max,
    ),
  };
}

/** Total silence a therapist may take mid-turn without losing the floor. */
export function endOfTurnLatencyMs(config: TurnControllerConfig): number {
  return config.possibleEndSilenceMs + config.confirmEndSilenceMs;
}

export type TurnObservation = {
  /** Whether the VAD considers the therapist to be speaking in this frame. */
  speaking: boolean;
  /** Monotonic clock in ms. */
  nowMs: number;
};

export type TurnTransition = {
  changed: boolean;
  from: TurnState;
  to: TurnState;
  reason: TurnTransitionReason | null;
};

/**
 * Only this state may produce a patient turn. Exported so callers can assert
 * it rather than re-deriving the rule.
 */
export function canGenerateTurn(state: TurnState): boolean {
  return state === "CONFIRMED_END";
}

/** States in which the therapist microphone should be capturing. */
export function micActive(state: TurnState): boolean {
  return (
    state === "LISTENING" ||
    state === "USER_SPEAKING" ||
    state === "POSSIBLE_END"
  );
}

/** States in which patient audio may be playing. */
export function playbackActive(state: TurnState): boolean {
  return state === "SPEAKING";
}

export type TurnController = {
  getState: () => TurnState;
  getGeneration: () => number;
  isCurrent: (generation: number) => boolean;
  getConfig: () => TurnControllerConfig;
  /** Accumulated therapist speech in the current turn. */
  getSpeechMs: () => number;
  /** Feed one VAD frame. Pure with respect to transcripts. */
  observe: (observation: TurnObservation) => TurnTransition;
  /** CONFIRMED_END → THINKING. Rejected from any other state. */
  confirm: () => TurnTransition;
  /** THINKING → SPEAKING. */
  beginSpeaking: () => TurnTransition;
  /** SPEAKING → LISTENING after playback completes. */
  finishSpeaking: () => TurnTransition;
  /** SPEAKING → LISTENING because the therapist interrupted. */
  bargeIn: () => TurnTransition;
  /** Force back to LISTENING and invalidate in-flight async work. */
  reset: () => TurnTransition;
};

export function createTurnController(
  overrides: Partial<TurnControllerConfig> = {},
): TurnController {
  const config = resolveTurnConfig(overrides);

  let state: TurnState = "LISTENING";
  let generation = 0;
  let speechMs = 0;
  let turnStartedAt: number | null = null;
  let lastSpeechAt: number | null = null;
  let possibleEndAt: number | null = null;
  let lastFrameAt: number | null = null;

  function resetTurnAccounting() {
    speechMs = 0;
    turnStartedAt = null;
    lastSpeechAt = null;
    possibleEndAt = null;
    lastFrameAt = null;
  }

  function to(
    next: TurnState,
    reason: TurnTransitionReason,
    opts: { bumpGeneration?: boolean } = {},
  ): TurnTransition {
    const from = state;
    state = next;
    if (opts.bumpGeneration) generation += 1;
    return { changed: from !== next, from, to: next, reason };
  }

  function noop(): TurnTransition {
    return { changed: false, from: state, to: state, reason: null };
  }

  return {
    getState: () => state,
    getGeneration: () => generation,
    isCurrent: (gen) => gen === generation,
    getConfig: () => ({ ...config }),
    getSpeechMs: () => speechMs,

    observe({ speaking, nowMs }) {
      // Frames are only meaningful while the mic owns the floor.
      if (!micActive(state)) return noop();

      const previousFrameAt = lastFrameAt;
      lastFrameAt = nowMs;

      if (speaking) {
        if (previousFrameAt != null) {
          speechMs += Math.max(0, nowMs - previousFrameAt);
        }
        lastSpeechAt = nowMs;
        possibleEndAt = null;
        if (turnStartedAt == null) turnStartedAt = nowMs;

        if (state === "LISTENING") {
          return to("USER_SPEAKING", "speech_started");
        }
        if (state === "POSSIBLE_END") {
          // The therapist was only pausing — they keep the floor.
          return to("USER_SPEAKING", "speech_resumed");
        }
        return noop();
      }

      // Silent frame.
      if (state === "LISTENING") return noop();

      if (state === "USER_SPEAKING") {
        const quietFor = lastSpeechAt == null ? 0 : nowMs - lastSpeechAt;
        if (quietFor >= config.possibleEndSilenceMs) {
          possibleEndAt = nowMs;
          return to("POSSIBLE_END", "silence_possible_end");
        }
        if (
          turnStartedAt != null &&
          nowMs - turnStartedAt >= config.maxTurnMs &&
          speechMs >= config.minSpeechMs
        ) {
          return to("CONFIRMED_END", "max_turn_reached");
        }
        return noop();
      }

      // POSSIBLE_END — wait for confirmation.
      const confirmedFor = possibleEndAt == null ? 0 : nowMs - possibleEndAt;
      if (
        confirmedFor >= config.confirmEndSilenceMs &&
        speechMs >= config.minSpeechMs
      ) {
        return to("CONFIRMED_END", "silence_confirmed");
      }
      if (
        turnStartedAt != null &&
        nowMs - turnStartedAt >= config.maxTurnMs &&
        speechMs >= config.minSpeechMs
      ) {
        return to("CONFIRMED_END", "max_turn_reached");
      }
      return noop();
    },

    confirm() {
      if (state !== "CONFIRMED_END") return noop();
      return to("THINKING", "confirmed");
    },

    beginSpeaking() {
      if (state !== "THINKING") return noop();
      return to("SPEAKING", "playback_started");
    },

    finishSpeaking() {
      if (state !== "SPEAKING") return noop();
      resetTurnAccounting();
      return to("LISTENING", "playback_ended", { bumpGeneration: true });
    },

    bargeIn() {
      if (state !== "SPEAKING") return noop();
      resetTurnAccounting();
      return to("LISTENING", "barge_in", { bumpGeneration: true });
    },

    reset() {
      resetTurnAccounting();
      return to("LISTENING", "reset", { bumpGeneration: true });
    },
  };
}

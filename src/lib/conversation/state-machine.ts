import type { ConversationState } from "@/lib/conversation/types";

/**
 * Valid HFTE conversation state transitions.
 * Invalid transitions throw — callers must never force state.
 */
const TRANSITIONS: Record<ConversationState, ReadonlySet<ConversationState>> =
  {
    Listening: new Set(["Processing", "Paused", "Finished", "Listening"]),
    Processing: new Set([
      "AvatarSpeaking",
      "Listening",
      "Paused",
      "Finished",
    ]),
    AvatarSpeaking: new Set([
      "Listening",
      "Paused",
      "Finished",
      "Processing", // interrupt → capture → process
    ]),
    Paused: new Set(["Listening", "Finished", "Paused"]),
    Finished: new Set(["Finished"]),
  };

export class InvalidConversationTransitionError extends Error {
  constructor(
    public readonly from: ConversationState,
    public readonly to: ConversationState,
  ) {
    super(`Invalid conversation transition: ${from} → ${to}`);
    this.name = "InvalidConversationTransitionError";
  }
}

export function canTransition(
  from: ConversationState,
  to: ConversationState,
): boolean {
  return TRANSITIONS[from]?.has(to) ?? false;
}

export function assertTransition(
  from: ConversationState,
  to: ConversationState,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidConversationTransitionError(from, to);
  }
}

export type ConversationControllerSnapshot = {
  state: ConversationState;
  generation: number;
  pausedAt: number | null;
  /** Accumulated paused wall time (ms) for optional timer freeze. */
  pausedAccumMs: number;
};

/**
 * Pure conversation controller — owns ConversationState only.
 * Side effects (mic, TTS, LLM) live in the React hook / pipeline adapters.
 */
export class ConversationController {
  private state: ConversationState;
  private generation = 0;
  private pausedAt: number | null = null;
  private pausedAccumMs = 0;
  private listeners = new Set<(snap: ConversationControllerSnapshot) => void>();

  constructor(initial: ConversationState = "Listening") {
    this.state = initial;
  }

  getState(): ConversationState {
    return this.state;
  }

  snapshot(): ConversationControllerSnapshot {
    return {
      state: this.state,
      generation: this.generation,
      pausedAt: this.pausedAt,
      pausedAccumMs: this.pausedAccumMs,
    };
  }

  subscribe(fn: (snap: ConversationControllerSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const snap = this.snapshot();
    for (const fn of this.listeners) fn(snap);
  }

  transition(to: ConversationState, now = Date.now()): ConversationState {
    assertTransition(this.state, to);
    const from = this.state;

    if (to === "Paused" && from !== "Paused") {
      this.pausedAt = now;
    }
    if (from === "Paused" && to !== "Paused" && this.pausedAt != null) {
      this.pausedAccumMs += Math.max(0, now - this.pausedAt);
      this.pausedAt = null;
    }
    if (to === "Finished") {
      if (this.pausedAt != null) {
        this.pausedAccumMs += Math.max(0, now - this.pausedAt);
        this.pausedAt = null;
      }
    }

    this.state = to;
    this.generation += 1;
    this.emit();
    return this.state;
  }

  /** Try transition; returns false instead of throwing. */
  tryTransition(to: ConversationState, now = Date.now()): boolean {
    if (!canTransition(this.state, to)) return false;
    this.transition(to, now);
    return true;
  }

  isPaused(): boolean {
    return this.state === "Paused";
  }

  isFinished(): boolean {
    return this.state === "Finished";
  }

  /** Wall-clock paused duration including an active pause. */
  pausedDurationMs(now = Date.now()): number {
    const active =
      this.pausedAt != null ? Math.max(0, now - this.pausedAt) : 0;
    return this.pausedAccumMs + active;
  }

  /** Whether LLM / STT work is allowed. */
  allowsNetworkWork(): boolean {
    return (
      this.state === "Listening" ||
      this.state === "Processing" ||
      this.state === "AvatarSpeaking"
    );
  }

  /** Whether microphone capture should be open. */
  allowsMicrophone(): boolean {
    return this.state === "Listening" || this.state === "AvatarSpeaking";
  }
}

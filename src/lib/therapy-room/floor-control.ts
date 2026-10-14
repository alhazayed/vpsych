/**
 * Floor control — the patient yields when the therapist starts speaking again
 * while the patient reply is still being generated (before any audio).
 *
 * The reply is still saved server-side. It is held, and voiced only if what
 * the therapist said turns out to be nothing (noise, no speech). A real new
 * therapist turn supersedes it; it is then recorded as unheard (heard_chars 0)
 * so assessment never judges words the therapist did not hear.
 *
 * Pure decisions only; the Therapy Room wires them to the mic and FSM.
 */

import type { ConversationState } from "./conversation-fsm";

/**
 * Continuous therapist speech needed to take the floor. Stricter than
 * barge-in (300 ms): nothing is playing yet, so a false positive costs a
 * reply rather than stopping audio.
 */
export const FLOOR_TAKE_MIN_SPEECH_MS = 450;

/** A held reply older than this is not voiced (the conversation moved on). */
export const HELD_REPLY_MAX_AGE_MS = 20_000;

/**
 * Floor control uses the same mic monitor as barge-in, so it follows the same
 * switches: the build flag and the trainee's "Interrupt the patient by
 * speaking" setting.
 */
export function floorControlEnabled(opts: {
  bargeInEnabled: boolean;
  bargeInByVoice: boolean;
}): boolean {
  return opts.bargeInEnabled && opts.bargeInByVoice;
}

export type FloorReplyAction =
  /** The floor-take was superseded by a real turn: record it as unheard. */
  | "unheard"
  /** The therapist is still talking or being transcribed: keep it. */
  | "hold"
  /** The floor-take came to nothing and the room is waiting: voice it now. */
  | "play";

/** A floor-take whose reply is still owed. */
export type PendingFloorTake = {
  /** Generation of the turn the patient yielded. */
  generation: number;
  /** The floor-take capture ended with no usable speech. */
  captureEnded: boolean;
};

/** What to do with a saved reply that arrived after the patient yielded. */
export function floorReplyAction(opts: {
  /** The floor-take still owed a reply (null once a real turn superseded it). */
  pending: PendingFloorTake | null;
  /** Generation of the turn this reply answers. */
  replyGeneration: number;
  state: ConversationState;
  /** Therapist speech in the open capture (ms); null when none is open. */
  openCaptureSpeechMs: number | null;
}): FloorReplyAction {
  if (!opts.pending || opts.pending.generation !== opts.replyGeneration) {
    return "unheard";
  }
  // Until the floor-take capture has ended empty, the therapist may still be
  // talking (or about to be transcribed): never speak over them.
  if (!opts.pending.captureEnded) return "hold";
  if (opts.state !== "LISTENING") return "hold";
  if (opts.openCaptureSpeechMs != null && opts.openCaptureSpeechMs > 0) {
    return "hold";
  }
  return "play";
}

/** Whether a held reply is still fresh enough to voice. */
export function heldReplyPlayable(opts: { heldAt: number; now: number }): boolean {
  return opts.now - opts.heldAt <= HELD_REPLY_MAX_AGE_MS;
}

/**
 * Monotonic client-side turn generation fence.
 *
 * Every asynchronous operation of a patient turn (SSE events, TTS fetches,
 * playback callbacks, completion handlers) captures a ticket at start and
 * checks `isCurrent()` before applying any effect. Advancing the fence — on
 * barge-in, a new turn, voice-mode toggle, or session end — aborts the active
 * ticket's AbortController and makes every late callback from it a no-op.
 */

export type TurnTicket = {
  /** Generation number captured at turn start. */
  readonly generation: number;
  /** Aborted when the fence advances past this ticket. */
  readonly signal: AbortSignal;
  /** True while this ticket is the newest and has not been aborted. */
  isCurrent: () => boolean;
};

export type TurnFence = {
  /** Abort the active ticket (if any) and issue a new current ticket. */
  begin: () => TurnTicket;
  /** Abort the active ticket without starting a new turn. Returns true if one was active. */
  invalidate: () => boolean;
  /** Current generation number. */
  generation: () => number;
  /** True while an unaborted ticket is current. */
  active: () => boolean;
};

export function createTurnFence(): TurnFence {
  let generation = 0;
  let controller: AbortController | null = null;

  const invalidate = () => {
    const had = Boolean(controller && !controller.signal.aborted);
    generation += 1;
    controller?.abort();
    controller = null;
    return had;
  };

  return {
    begin() {
      invalidate();
      const mine = ++generation;
      const ctl = new AbortController();
      controller = ctl;
      return {
        generation: mine,
        signal: ctl.signal,
        isCurrent: () => generation === mine && !ctl.signal.aborted,
      };
    },
    invalidate,
    generation: () => generation,
    active: () => Boolean(controller && !controller.signal.aborted),
  };
}

/**
 * Therapist-interruption latch (Phase 9.1R).
 *
 * Mark when the therapist cuts off patient speech. Consume only when a
 * replacement therapist turn with usable content is about to be submitted.
 * Empty / no-speech attempts must NOT clear the latch.
 */

export type TherapistInterruptedFlag = {
  mark: () => void;
  isPending: () => boolean;
  /** Consume and return the prior pending value. */
  consumeForSubmit: () => boolean;
  clear: () => void;
};

export function createTherapistInterruptedFlag(): TherapistInterruptedFlag {
  let pending = false;
  return {
    mark() {
      pending = true;
    },
    isPending() {
      return pending;
    },
    consumeForSubmit() {
      const value = pending;
      pending = false;
      return value;
    },
    clear() {
      pending = false;
    },
  };
}

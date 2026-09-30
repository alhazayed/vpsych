/**
 * Synchronous microphone ownership claim (Phase 9.1R).
 *
 * React state is too slow to prevent double getUserMedia during
 * `await startMicWavRecording()`. Claim before the first await; release on
 * stop / failure / end / unmount.
 */

export type MicClaim = {
  /** Returns true if this caller now owns the mic acquisition slot. */
  tryClaim: () => boolean;
  release: () => void;
  isClaimed: () => boolean;
};

export function createMicClaim(): MicClaim {
  let claimed = false;
  return {
    tryClaim() {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    release() {
      claimed = false;
    },
    isClaimed() {
      return claimed;
    },
  };
}

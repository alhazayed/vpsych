/**
 * Voice turn UI lifecycle helpers (Phase 9.1R).
 *
 * Separates STATE CLEANUP from STALE RESULT APPLICATION:
 * - Cleanup (pending=false, mic release) always runs when a turn finishes.
 * - Content/playback/status updates remain gated by the turn fence.
 */

import type { VoiceTurnId } from "@/lib/voice/turn-fence";

/** True when UI may apply patient content / status / playback for this turn. */
export function shouldApplyVoiceTurnResult(params: {
  turnId: VoiceTurnId;
  isActive: (turnId: VoiceTurnId) => boolean;
}): boolean {
  return params.isActive(params.turnId);
}

/**
 * Always clear the busy/pending latch when a turn attempt ends — even if the
 * fence invalidated mid-flight (session end, supersede, failed end request).
 */
export function clearVoiceTurnPending(setPending: (pending: boolean) => void) {
  setPending(false);
}

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

/**
 * What to do with patient audio when the therapist starts a new turn
 * (mic press / text send) — Human Conversation Fidelity.
 *
 * - `interrupt`: patient audio is AUDIBLE → stop it and mark the next turn as
 *   a therapist interruption (Phase 9.1 latch).
 * - `cancel_scheduled`: a reply is synthesizing but not yet audible → cancel
 *   it so the patient never starts talking over the therapist, WITHOUT the
 *   interruption flag (nothing was cut off).
 * - `none`: nothing pending.
 */
export type TherapistTurnStartAction = "interrupt" | "cancel_scheduled" | "none";

export function therapistTurnStartAction(params: {
  patientAudible: boolean;
  patientAudioScheduled: boolean;
}): TherapistTurnStartAction {
  if (params.patientAudible) return "interrupt";
  if (params.patientAudioScheduled) return "cancel_scheduled";
  return "none";
}

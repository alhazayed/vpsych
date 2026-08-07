/**
 * Interrupt Handling — barge-in / cancel / emergency stop.
 * Wires presentation interrupts; clients should send therapistInterrupted
 * on the message API (closes RT-06 when realtime UI is enabled).
 */

import type { InterruptReason, VoiceGatewayState } from "@/lib/realtime/types";

export type InterruptEvent = {
  reason: InterruptReason;
  at: string;
  abortGeneration: boolean;
  abortPlayback: boolean;
  notifyServerTherapistInterrupted: boolean;
};

export function planInterrupt(reason: InterruptReason): InterruptEvent {
  const at = new Date().toISOString();
  switch (reason) {
    case "therapist_barge_in":
      return {
        reason,
        at,
        abortGeneration: true,
        abortPlayback: true,
        notifyServerTherapistInterrupted: true,
      };
    case "user_cancel":
      return {
        reason,
        at,
        abortGeneration: true,
        abortPlayback: true,
        notifyServerTherapistInterrupted: false,
      };
    case "network_loss":
      return {
        reason,
        at,
        abortGeneration: false,
        abortPlayback: true,
        notifyServerTherapistInterrupted: false,
      };
    case "timeout":
      return {
        reason,
        at,
        abortGeneration: true,
        abortPlayback: true,
        notifyServerTherapistInterrupted: false,
      };
    case "emergency_stop":
    case "session_expired":
      return {
        reason,
        at,
        abortGeneration: true,
        abortPlayback: true,
        notifyServerTherapistInterrupted: false,
      };
  }
}

export function gatewayStateAfterInterrupt(
  reason: InterruptReason,
): VoiceGatewayState {
  if (reason === "therapist_barge_in") return "interrupted";
  if (reason === "network_loss") return "recovering";
  if (reason === "emergency_stop" || reason === "session_expired") {
    return "error";
  }
  return "idle";
}

/**
 * Tip-of-conversation predicate (Phase 9.1R / 9.1S).
 *
 * Application-level early rejection uses this helper. The authoritative
 * atomic check lives inside `insert_assistant_message` (p_user_message_id)
 * under `sessions` FOR UPDATE — see migration
 * `phase91s_atomic_assistant_tip_guard`.
 */

export type SessionMessageTip = {
  id: string;
  role: string;
};

/**
 * True when it is safe to persist the assistant reply for `expectedUserMessageId`.
 */
export function isAssistantPersistTipCurrent(params: {
  expectedUserMessageId: string;
  tip: SessionMessageTip | null | undefined;
}): boolean {
  const tip = params.tip;
  if (!tip) return false;
  if (tip.role !== "user") return false;
  return tip.id === params.expectedUserMessageId;
}

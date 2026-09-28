/**
 * Server-side tip-of-conversation guard (Phase 9.1R).
 *
 * Without a schema migration, the safest existing protection against a late
 * aborted turn persisting an assistant reply is: the assistant may only be
 * inserted when the user message that started this request is still the tip
 * of `session_messages`.
 *
 * The RPC `insert_assistant_message` only checks that the last role is
 * `user` — it does NOT check which user message. Two concurrent turns can
 * therefore pair a stale assistant with a newer user turn. This helper closes
 * that gap using message ids already returned by the user INSERT.
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

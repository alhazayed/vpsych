/**
 * Hot-path helpers for session transcript reads.
 * Keeps AI turns from loading unbounded history on every message.
 */

export const PATIENT_HISTORY_LIMIT = 40;

/** Keep the most recent N turns in chronological order. */
export function takeRecentMessages<T>(messages: T[], limit = PATIENT_HISTORY_LIMIT): T[] {
  if (messages.length <= limit) return messages;
  return messages.slice(-limit);
}

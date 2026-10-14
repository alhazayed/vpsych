/**
 * How far into the session a message was sent, as "mm:ss" for the
 * time-stamped transcript. Null when either time is not a valid date. A
 * message stamped before the session start (clock skew) shows as 00:00.
 */
export function sessionElapsedLabel(startedAt: string, sentAt: string): string | null {
  const start = Date.parse(startedAt);
  const sent = Date.parse(sentAt);
  if (Number.isNaN(start) || Number.isNaN(sent)) return null;
  const seconds = Math.max(0, Math.floor((sent - start) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

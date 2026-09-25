/**
 * Sanitize errors returned to clients — never leak provider bodies,
 * SQL detail, or environment variable names.
 *
 * Phase 8.3: allowlist-only. Unknown messages always collapse to `fallback`.
 */

/** Product messages that may cross the client boundary verbatim. */
export const ALLOWED_CLIENT_MESSAGES = new Set<string>([
  "Unauthorized",
  "Forbidden",
  "Not found",
  "Conflict",
  "Too many requests",
  "Invalid JSON",
  "message required",
  "Session is not active",
  "Session not found",
  "Realtime streaming is not enabled",
  "Emotion state unavailable",
  "Supervisor unavailable",
  "Turn failed",
  "Streaming turn failed",
  "Database error",
  "Internal server error",
  "Request failed",
  "Upstream provider error",
  "MFA required",
]);

export function clientSafeError(
  fallback: string,
  err?: { message?: string } | string | null,
): string {
  if (!err) return fallback;
  const message = typeof err === "string" ? err : err.message ?? "";
  if (message && ALLOWED_CLIENT_MESSAGES.has(message)) {
    return message;
  }
  // Allow the fallback itself when callers pass it as both args.
  if (message && message === fallback && ALLOWED_CLIENT_MESSAGES.has(fallback)) {
    return fallback;
  }
  return fallback;
}

/** SSE / streaming helper — never forwards raw Error.message. */
export function clientSafeStreamError(
  err: unknown,
  fallback = "Streaming turn failed",
): string {
  if (typeof err === "string") return clientSafeError(fallback, err);
  if (err && typeof err === "object" && "message" in err) {
    return clientSafeError(fallback, err as { message?: string });
  }
  return fallback;
}

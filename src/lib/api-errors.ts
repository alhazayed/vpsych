/**
 * Sanitize errors returned to clients — never leak provider bodies,
 * SQL detail, or environment variable names.
 */

const UNSAFE_CLIENT_ERROR =
  /exception|stack|postgres|supabase|openai|elevenlabs|api[_ ]?key|secret|token|vault|hmac|REPORT_WRITE|SERVICE_ROLE|relation\s|does not exist|row-level security|violates|PGRST|schema cache|permission denied|foreign key|duplicate key|column\s+".*"\s+of\s+relation/i;

export function clientSafeError(
  fallback: string,
  err?: { message?: string } | string | null,
): string {
  if (!err) return fallback;
  const message = typeof err === "string" ? err : err.message ?? "";
  // Allow short, already-safe product messages through.
  if (message && message.length <= 120 && !UNSAFE_CLIENT_ERROR.test(message)) {
    return message;
  }
  return fallback;
}

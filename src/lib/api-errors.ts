/**
 * Sanitize errors returned to clients — never leak provider bodies,
 * SQL detail, or environment variable names.
 */

export function clientSafeError(
  fallback: string,
  err?: { message?: string } | string | null,
): string {
  if (!err) return fallback;
  const message = typeof err === "string" ? err : err.message ?? "";
  // Allow short, already-safe product messages through.
  if (
    message &&
    message.length <= 120 &&
    !/exception|stack|postgres|supabase|openai|elevenlabs|api[_ ]?key|secret|token|vault|hmac|REPORT_WRITE|SERVICE_ROLE/i.test(
      message,
    )
  ) {
    return message;
  }
  return fallback;
}

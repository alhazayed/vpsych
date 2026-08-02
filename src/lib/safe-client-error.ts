/**
 * Sanitize errors returned to API clients — never leak DB/provider internals
 * or stack fragments that may contain secrets / PHI context.
 */

const SAFE_CODES = new Set([
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "RATE_LIMIT",
  "CONFLICT",
  "UNAVAILABLE",
]);

export function publicApiError(
  status: number,
  fallback = "Request failed",
): string {
  if (status === 401) return "Unauthorized";
  if (status === 403) return "Forbidden";
  if (status === 404) return "Not found";
  if (status === 409) return "Conflict";
  if (status === 429) return "Too many requests";
  if (status >= 500) return "Internal server error";
  return fallback;
}

/** Map unknown/provider errors to a stable client-safe message + code. */
export function sanitizeProviderError(
  error: unknown,
  opts?: { code?: string; fallback?: string },
): { error: string; code: string } {
  const code = opts?.code ?? "PROVIDER_ERROR";
  const fallback = opts?.fallback ?? "Upstream provider error";

  if (error && typeof error === "object" && "code" in error) {
    const c = String((error as { code?: string }).code ?? "");
    if (SAFE_CODES.has(c)) {
      const msg =
        "message" in error && typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : fallback;
      return { error: msg, code: c };
    }
  }

  // Log-worthy detail stays server-side; callers should console.warn first.
  return { error: fallback, code };
}

export function sanitizeDbError(message?: string | null): string {
  void message;
  return "Database error";
}

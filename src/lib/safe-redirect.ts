/**
 * Allow only same-origin relative paths for post-auth redirects.
 * Rejects protocol-relative ("//evil"), absolute URLs, and empty values.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/avatars",
): string {
  if (!next) return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  // Block scheme-looking paths like "/https://evil"
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)) return fallback;
  return trimmed;
}

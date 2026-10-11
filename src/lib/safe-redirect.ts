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
  // Browsers drop tabs and newlines inside a URL, so "/\t/evil.com" would
  // become "//evil.com". No real path contains whitespace or control chars.
  if (/[\s\x00-\x1f\x7f]/.test(trimmed)) return fallback;
  // Final word: the browser's own parser must keep it on this origin.
  const base = "http://same-origin.invalid";
  try {
    if (new URL(trimmed, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return trimmed;
}

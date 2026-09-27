/**
 * Phase 10D — map machine/product error codes to educator-facing copy keys.
 * Server status codes and immutability semantics stay unchanged; this is UI only.
 */

export type AdminProductErrorCode =
  | "lifecycle_immutable"
  | "comorbidity_unlisted"
  | "comorbidity_incompatible"
  | "comorbidity_unavailable"
  | "MFA_REQUIRED"
  | "mfa_required"
  | "publish_not_ready"
  | "not_found"
  | "forbidden"
  | "rate_limited";

const CODE_ALIASES: Record<string, AdminProductErrorCode> = {
  lifecycle_immutable: "lifecycle_immutable",
  LIFECYCLE_IMMUTABLE: "lifecycle_immutable",
  comorbidity_unlisted: "comorbidity_unlisted",
  comorbidity_incompatible: "comorbidity_incompatible",
  comorbidity_unavailable: "comorbidity_unavailable",
  MFA_REQUIRED: "MFA_REQUIRED",
  mfa_required: "mfa_required",
  publish_not_ready: "publish_not_ready",
  not_found: "not_found",
  forbidden: "forbidden",
  rate_limited: "rate_limited",
};

/** Extract a known product code from an API error string or object. */
export function extractAdminProductErrorCode(
  error: unknown,
): AdminProductErrorCode | null {
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (CODE_ALIASES[trimmed]) return CODE_ALIASES[trimmed];
    const match = trimmed.match(
      /\b(lifecycle_immutable|comorbidity_unlisted|comorbidity_incompatible|comorbidity_unavailable|MFA_REQUIRED|mfa_required|publish_not_ready)\b/,
    );
    if (match?.[1] && CODE_ALIASES[match[1]]) return CODE_ALIASES[match[1]];
    return null;
  }
  if (error && typeof error === "object") {
    const rec = error as { code?: unknown; error?: unknown };
    if (typeof rec.code === "string" && CODE_ALIASES[rec.code]) {
      return CODE_ALIASES[rec.code];
    }
    return extractAdminProductErrorCode(rec.error);
  }
  return null;
}

/**
 * Resolve educator-facing message. `t` should look up keys under
 * `admin.productErrors.*` (or a compatible map). Falls back to the original
 * string when no code is recognized — callers should still avoid raw stacks.
 */
export function educatorAdminError(
  error: unknown,
  t: (key: AdminProductErrorCode) => string,
  fallback = "Something went wrong. Please try again.",
): string {
  const code = extractAdminProductErrorCode(error);
  if (code) {
    try {
      return t(code);
    } catch {
      /* missing translation — fall through */
    }
  }
  if (typeof error === "string" && error.trim() && !looksTechnical(error)) {
    return error.trim();
  }
  return fallback;
}

function looksTechnical(msg: string): boolean {
  return (
    /ECONNREFUSED|postgres|supabase|stack|at Object\.|HMAC|RLS|AAL2|RPC/i.test(
      msg,
    ) || /^[a-z]+_[a-z_]+$/.test(msg.trim())
  );
}

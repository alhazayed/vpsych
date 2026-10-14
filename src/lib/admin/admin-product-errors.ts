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

/** Keys under `admin.actionErrors`, for admin tools whose routes answer in English. */
export type AdminActionErrorKey =
  | "mfaRequired"
  | "forbidden"
  | "notFound"
  | "rateLimited"
  | "invalid"
  | "failed";

/** Picks the localized message for a failed admin request by code or status. */
export function adminActionErrorKey(
  status: number,
  code?: unknown,
): AdminActionErrorKey {
  if (code === "MFA_REQUIRED" || code === "mfa_required") return "mfaRequired";
  if (status === 401 || status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  if (status === 400 || status === 422) return "invalid";
  return "failed";
}

/**
 * Validation issues a preview/save route returned (400 with an `error` array),
 * so the admin can see what to fix. Server text is shown as-is; it is the
 * validator's own output, never a database or provider message.
 */
export function adminValidationIssues(body: unknown): string[] {
  const error = (body as { error?: unknown } | null)?.error;
  if (!Array.isArray(error)) return [];
  return error
    .map((issue) =>
      typeof issue === "string"
        ? issue
        : issue && typeof issue === "object" && "message" in issue
          ? String((issue as { message: unknown }).message)
          : "",
    )
    .filter(Boolean)
    .slice(0, 10);
}

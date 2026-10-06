/**
 * Account approval gate: a new sign-up cannot use VPsych until the
 * superadmin approves it (`profiles.approval_status`, migration
 * 20261006080000_account_approval.sql).
 *
 * Enforced in three layers: middleware (every page + API), requireProfile /
 * requireApiUser, and RESTRICTIVE RLS on sessions + session_messages.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected";

export const APPROVAL_STATUSES: readonly ApprovalStatus[] = [
  "pending",
  "approved",
  "rejected",
];

/** The screen a signed-in but unapproved user is confined to. */
export const PENDING_APPROVAL_PATH = "/pending";

/** JSON error code returned by APIs to an unapproved account. */
export const ACCOUNT_NOT_APPROVED_CODE = "ACCOUNT_NOT_APPROVED";

export function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return (
    typeof value === "string" &&
    (APPROVAL_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Effective status for a profile row. Admins are always approved. A row
 * without the column (migration not applied yet) reads as approved so the
 * deploy order of app and migration cannot lock everyone out; any other
 * value that is not a known status fails closed as pending.
 */
export function resolveApprovalStatus(
  profile: { role?: string | null; approval_status?: unknown } | null,
): ApprovalStatus {
  if (!profile) return "pending";
  if (profile.role === "admin") return "approved";
  if (!("approval_status" in profile) || profile.approval_status === undefined) {
    return "approved";
  }
  return isApprovalStatus(profile.approval_status)
    ? profile.approval_status
    : "pending";
}

export function isAccountApproved(
  profile: { role?: string | null; approval_status?: unknown } | null,
): boolean {
  return resolveApprovalStatus(profile) === "approved";
}

/**
 * Signed-in paths an unapproved user may still reach: the pending screen
 * itself and the auth flows (MFA, password reset, callback). Public paths are
 * handled separately by the middleware.
 */
export function isApprovalExemptPath(path: string): boolean {
  if (path === PENDING_APPROVAL_PATH || path.startsWith(`${PENDING_APPROVAL_PATH}/`)) {
    return true;
  }
  if (path.startsWith("/auth/")) return true;
  return false;
}

/** Postgres "undefined column": the approval migration is not applied yet. */
export function isMissingApprovalColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  return /approval_status/.test(error.message ?? "") &&
    /does not exist|could not find/i.test(error.message ?? "");
}

/** Admin decision body value → stored status ("pending" re-opens a decision). */
export function parseApprovalDecision(value: unknown): ApprovalStatus | null {
  if (value === "approve") return "approved";
  if (value === "reject") return "rejected";
  if (value === "pending") return "pending";
  return null;
}

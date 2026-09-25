/**
 * Admin MFA / AAL enforcement (Phase 8.3) + bootstrap paths (Phase 8.9).
 *
 * Therapists are unaffected. Admins must present Supabase AAL2 when enforcement
 * is enabled. Toggle with ADMIN_MFA_REQUIRED=true|false.
 * Default: enforced when NODE_ENV=production.
 *
 * Bootstrap routes (`/auth/mfa`, `/auth/mfa/enroll`) require an authenticated
 * admin identity but must NOT themselves require AAL2 — otherwise first-time
 * enrollment is impossible.
 */

import { safeRedirectPath } from "@/lib/safe-redirect";

export type AdminMfaLevel = "aal1" | "aal2";

/** Challenge (verify existing TOTP factor). */
export const ADMIN_MFA_CHALLENGE_PATH = "/auth/mfa";

/** First-time TOTP enrollment for admins without a verified factor. */
export const ADMIN_MFA_ENROLL_PATH = "/auth/mfa/enroll";

export function isAdminMfaEnforced(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const flag = env.ADMIN_MFA_REQUIRED?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  if (flag === "true" || flag === "1" || flag === "on") return true;
  return env.NODE_ENV === "production";
}

export type AssuranceSnapshot = {
  currentLevel: AdminMfaLevel | string | null;
  nextLevel: AdminMfaLevel | string | null;
};

/** True when the session already satisfies AAL2. */
export function hasAdminMfaAssurance(snapshot: AssuranceSnapshot): boolean {
  return snapshot.currentLevel === "aal2";
}

export type AdminMfaCheckResult =
  | { ok: true }
  | { ok: false; reason: "mfa_required"; currentLevel: string | null };

/**
 * Evaluate MFA for an already-authorized admin. Does not enroll factors —
 * callers must challenge via Supabase Auth MFA APIs.
 */
export function evaluateAdminMfa(opts: {
  enforced: boolean;
  assurance: AssuranceSnapshot | null;
}): AdminMfaCheckResult {
  if (!opts.enforced) return { ok: true };
  if (!opts.assurance) {
    return { ok: false, reason: "mfa_required", currentLevel: null };
  }
  if (hasAdminMfaAssurance(opts.assurance)) return { ok: true };
  return {
    ok: false,
    reason: "mfa_required",
    currentLevel:
      typeof opts.assurance.currentLevel === "string"
        ? opts.assurance.currentLevel
        : null,
  };
}

/** True for MFA bootstrap UI paths (challenge or enroll). */
export function isAdminMfaBootstrapPath(path: string): boolean {
  return (
    path === ADMIN_MFA_CHALLENGE_PATH ||
    path === ADMIN_MFA_ENROLL_PATH ||
    path.startsWith(`${ADMIN_MFA_CHALLENGE_PATH}/`) ||
    path.startsWith(`${ADMIN_MFA_ENROLL_PATH}/`)
  );
}

/**
 * Safe post-MFA destination. Defaults to admin overview. Never returns
 * bootstrap paths (would loop).
 */
export function adminMfaReturnPath(
  next: string | null | undefined,
  fallback = "/admin",
): string {
  const dest = safeRedirectPath(next, fallback);
  if (isAdminMfaBootstrapPath(dest.split("?")[0] ?? dest)) {
    return fallback;
  }
  if (dest.startsWith("/login") || dest.startsWith("/signup")) {
    return fallback;
  }
  return dest;
}

/** Build challenge URL with open-redirect-safe next. */
export function adminMfaChallengeHref(
  next: string | null | undefined = "/admin",
): string {
  const dest = adminMfaReturnPath(next);
  return `${ADMIN_MFA_CHALLENGE_PATH}?next=${encodeURIComponent(dest)}`;
}

/** Build enrollment URL with open-redirect-safe next. */
export function adminMfaEnrollHref(
  next: string | null | undefined = "/admin",
): string {
  const dest = adminMfaReturnPath(next);
  return `${ADMIN_MFA_ENROLL_PATH}?next=${encodeURIComponent(dest)}`;
}

export type AdminMfaFactorSummary = {
  id: string;
  status: string;
};

/**
 * Decide post-password-login destination for an admin when MFA is enforced.
 * Pure helper — callers supply assurance + factors from Supabase Auth.
 */
export function resolveAdminPostLoginPath(opts: {
  enforced: boolean;
  isAdmin: boolean;
  currentLevel: string | null;
  verifiedTotpFactors: AdminMfaFactorSummary[];
  intendedNext: string | null | undefined;
}): string {
  if (!opts.enforced || !opts.isAdmin) {
    return safeRedirectPath(opts.intendedNext, "/avatars");
  }
  // Login default next is /avatars; after MFA send admins to the dashboard
  // unless they requested a specific non-avatar path.
  const raw = opts.intendedNext?.trim();
  const preferred =
    !raw || raw === "/avatars" ? "/admin" : adminMfaReturnPath(raw, "/admin");
  if (opts.currentLevel === "aal2") {
    return preferred;
  }
  if (opts.verifiedTotpFactors.length === 0) {
    return adminMfaEnrollHref(preferred);
  }
  return adminMfaChallengeHref(preferred);
}

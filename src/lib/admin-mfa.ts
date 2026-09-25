/**
 * Admin MFA / AAL enforcement (Phase 8.3).
 *
 * Therapists are unaffected. Admins must present Supabase AAL2 when enforcement
 * is enabled. Toggle with ADMIN_MFA_REQUIRED=true|false.
 * Default: enforced when NODE_ENV=production.
 */

export type AdminMfaLevel = "aal1" | "aal2";

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

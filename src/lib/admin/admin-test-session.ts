/**
 * Phase 3C — Admin Test Conversation isolation helpers.
 *
 * Authoritative marker: sessions.clinical_snapshot.admin_test === true
 * (server-written only by POST /api/admin/avatars/[id]/test-session).
 *
 * Retention policy remains a product decision — sessions persist via the
 * existing architecture; no TTL / auto-delete in Phase 3C-1…5.
 */

import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import type { VirtualPatientLifecycleStatus } from "@/lib/admin/virtual-patient-lifecycle";

export const ADMIN_TEST_LABEL = "ADMIN TEST — NOT A LEARNER SESSION" as const;

export const ADMIN_TEST_BANNER_EN = ADMIN_TEST_LABEL;
export const ADMIN_TEST_BANNER_AR = "اختبار إداري — ليس جلسة لمتدرب";

export type AdminTestSkipCheck = {
  snapshot: unknown;
  callerIsAdmin: boolean;
  therapistId: string;
  callerId: string;
};

export type AdminTestSkipResult =
  | { ok: true }
  | { ok: false; reason: "not_admin_test" | "not_admin" | "not_owner" };

/**
 * True when the session clinical_snapshot carries the admin-test marker.
 */
export function isAdminTestSnapshot(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  return (snapshot as { admin_test?: unknown }).admin_test === true;
}

/**
 * Learner-training sessions for analytics / history metrics.
 * Admin-test sessions must be excluded from learner aggregates.
 */
export function isLearnerTrainingSnapshot(snapshot: unknown): boolean {
  return !isAdminTestSnapshot(snapshot);
}

/**
 * Apply immutable admin-test marker onto a case snapshot immediately before
 * sessions INSERT. Does not mutate the input object.
 */
export function withAdminTestMarker(
  snapshot: CaseInstanceSnapshot,
): CaseInstanceSnapshot & {
  admin_test: true;
  admin_test_label: typeof ADMIN_TEST_LABEL;
} {
  return {
    ...snapshot,
    admin_test: true,
    admin_test_label: ADMIN_TEST_LABEL,
  };
}

/**
 * Defense-in-depth for the learner create path — never persist a forged marker.
 */
export function stripAdminTestMarker(
  snapshot: CaseInstanceSnapshot,
): CaseInstanceSnapshot {
  if (!isAdminTestSnapshot(snapshot)) return snapshot;
  const {
    admin_test: _a,
    admin_test_label: _b,
    ...rest
  } = snapshot as CaseInstanceSnapshot & {
    admin_test?: boolean;
    admin_test_label?: string;
  };
  void _a;
  void _b;
  return rest;
}

/**
 * Central skip predicate for POST /api/sessions/[id]/end.
 * Skip learner pipeline only when marker + admin role + ownership all hold.
 */
export function assertAdminTestSkipAllowed(
  opts: AdminTestSkipCheck,
): AdminTestSkipResult {
  if (!isAdminTestSnapshot(opts.snapshot)) {
    return { ok: false, reason: "not_admin_test" };
  }
  if (!opts.callerIsAdmin) {
    return { ok: false, reason: "not_admin" };
  }
  if (opts.therapistId !== opts.callerId) {
    return { ok: false, reason: "not_owner" };
  }
  return { ok: true };
}

/**
 * MVP eligibility: testing only. Encode once — do not scatter in UI/API.
 */
export function assertAvatarEligibleForAdminTest(
  lifecycle: VirtualPatientLifecycleStatus | string | null | undefined,
): { ok: true } | { ok: false; status: number; error: string } {
  if (lifecycle === "testing") {
    return { ok: true };
  }
  if (lifecycle === "archived") {
    return {
      ok: false,
      status: 409,
      error: "Archived virtual patients cannot be tested.",
    };
  }
  if (lifecycle === "draft") {
    return {
      ok: false,
      status: 409,
      error: "Move the virtual patient to Testing before starting a test conversation.",
    };
  }
  if (lifecycle === "published") {
    return {
      ok: false,
      status: 409,
      error: "Published virtual patients cannot start an admin test in MVP. Use a Testing copy.",
    };
  }
  return {
    ok: false,
    status: 409,
    error: "Virtual patient is not eligible for an admin test conversation.",
  };
}

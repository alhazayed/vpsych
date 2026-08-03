/**
 * Tenant isolation helpers (application-layer; DB RLS is source of truth).
 */

import type { InstitutionMembership } from "@/lib/enterprise/types";
import {
  canAct,
  type EnterprisePermission,
  isSuperAdministrator,
} from "@/lib/enterprise/roles";
import type { PlatformRole } from "@/lib/enterprise/types";

export type TenantContext = {
  platformRole: PlatformRole;
  memberships: InstitutionMembership[];
};

export function institutionsForUser(ctx: TenantContext): string[] {
  if (isSuperAdministrator(ctx.platformRole)) {
    return ctx.memberships.map((m) => m.institution_id);
  }
  return [
    ...new Set(
      ctx.memberships.filter((m) => m.is_active).map((m) => m.institution_id),
    ),
  ];
}

export function membershipsForInstitution(
  ctx: TenantContext,
  institutionId: string,
): InstitutionMembership[] {
  return ctx.memberships.filter(
    (m) => m.is_active && m.institution_id === institutionId,
  );
}

export function canAccessInstitution(
  ctx: TenantContext,
  institutionId: string,
): boolean {
  if (isSuperAdministrator(ctx.platformRole)) return true;
  return membershipsForInstitution(ctx, institutionId).length > 0;
}

export function canPermissionOnInstitution(
  ctx: TenantContext,
  institutionId: string,
  permission: EnterprisePermission,
): boolean {
  if (isSuperAdministrator(ctx.platformRole)) return true;
  if (!canAccessInstitution(ctx, institutionId)) return false;
  const roles = membershipsForInstitution(ctx, institutionId).map((m) => m.role);
  return canAct(ctx.platformRole, roles, permission);
}

/**
 * Filter a list of rows that carry institution_id to those the actor may see.
 * Super admins see all; others only their memberships.
 */
export function filterByTenant<T extends { institution_id: string }>(
  ctx: TenantContext,
  rows: T[],
): T[] {
  if (isSuperAdministrator(ctx.platformRole)) return rows;
  const allowed = new Set(institutionsForUser(ctx));
  return rows.filter((r) => allowed.has(r.institution_id));
}

/**
 * Reject cross-tenant contamination: a resource from institution A must not
 * be attached to a completion/session scoped to institution B.
 */
export function assertSameTenant(
  leftInstitutionId: string,
  rightInstitutionId: string,
): { ok: true } | { ok: false; code: "tenant_isolation_violation" } {
  if (leftInstitutionId !== rightInstitutionId) {
    return { ok: false, code: "tenant_isolation_violation" };
  }
  return { ok: true };
}

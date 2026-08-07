/**
 * Tenant isolation — Stage 10.
 * Every row-scoped check funnels through organization_id equality.
 * No tenant may access another tenant's data unless platform global role.
 */

import { hasPermission, isCrossTenantRole } from "@/lib/enterprise/rbac";
import type {
  EnterpriseRole,
  TenantIsolationCheck,
  TenantType,
} from "@/lib/enterprise/types";

export const TENANT_TYPES: readonly TenantType[] = [
  "university",
  "hospital",
  "clinic",
  "corporate",
  "government",
  "private_organization",
] as const;

export function isTenantType(value: string): value is TenantType {
  return (TENANT_TYPES as readonly string[]).includes(value);
}

/**
 * Hard isolation gate for resource access.
 * Platform globals may cross tenants only with an explicit permission.
 */
export function assertTenantAccess(opts: {
  actorRole: EnterpriseRole;
  actorOrganizationId: string | null;
  resourceOrganizationId: string | null;
  permission: Parameters<typeof hasPermission>[1];
}): TenantIsolationCheck {
  const violations: string[] = [];

  if (!hasPermission(opts.actorRole, opts.permission)) {
    violations.push(`missing_permission:${opts.permission}`);
  }

  const resourceOrg = opts.resourceOrganizationId;
  const actorOrg = opts.actorOrganizationId;

  if (resourceOrg == null) {
    // Platform-scoped resources (shared libraries) — require libraries.read+ or manage
    if (
      !isCrossTenantRole(opts.actorRole) &&
      opts.permission.startsWith("libraries.") === false &&
      opts.permission !== "certificates.verify"
    ) {
      violations.push("null_resource_org_requires_platform_or_library_scope");
    }
  } else if (actorOrg !== resourceOrg) {
    if (!isCrossTenantRole(opts.actorRole)) {
      violations.push(
        `cross_tenant_denied:actor=${actorOrg ?? "null"}:resource=${resourceOrg}`,
      );
    }
  }

  return { ok: violations.length === 0, violations };
}

/** Filter rows to a single tenant (in-memory isolation helper). */
export function isolateByOrganization<T extends { organization_id: string | null }>(
  rows: T[],
  organizationId: string,
): T[] {
  return rows.filter((r) => r.organization_id === organizationId);
}

/**
 * Verify two memberships cannot see each other's private rows.
 * Used by isolation tests / disaster-recovery drills.
 */
export function verifyMutualIsolation(opts: {
  tenantA: string;
  tenantB: string;
  rowsA: Array<{ organization_id: string | null }>;
  rowsB: Array<{ organization_id: string | null }>;
}): TenantIsolationCheck {
  const violations: string[] = [];
  for (const r of opts.rowsA) {
    if (r.organization_id === opts.tenantB) {
      violations.push(`tenant_a_row_leaked_to_b:${opts.tenantB}`);
    }
  }
  for (const r of opts.rowsB) {
    if (r.organization_id === opts.tenantA) {
      violations.push(`tenant_b_row_leaked_to_a:${opts.tenantA}`);
    }
  }
  const crossA = isolateByOrganization(opts.rowsA, opts.tenantB);
  const crossB = isolateByOrganization(opts.rowsB, opts.tenantA);
  if (crossA.length > 0) violations.push(`filter_leak_a_to_b:${crossA.length}`);
  if (crossB.length > 0) violations.push(`filter_leak_b_to_a:${crossB.length}`);
  return { ok: violations.length === 0, violations };
}

export function stampSessionTenant(opts: {
  primaryInstitutionId: string | null;
  membershipInstitutionId: string | null;
}): string | null {
  return opts.membershipInstitutionId ?? opts.primaryInstitutionId ?? null;
}

/**
 * Centralized Enterprise RBAC — Stage 10.
 * Permissions are authoritative here; Route Handlers consult this module.
 */

import type {
  EnterpriseRole,
  LegacyMembershipRole,
  Permission,
} from "@/lib/enterprise/types";

const ALL_READ: Permission[] = [
  "tenant.read",
  "programs.read",
  "courses.read",
  "assignments.read",
  "sessions.read_own",
  "reports.read_own",
  "libraries.read",
  "certificates.verify",
];

const ROLE_PERMISSIONS: Record<EnterpriseRole, readonly Permission[]> = {
  system_owner: [
    ...ALL_READ,
    "tenant.manage",
    "users.read",
    "users.manage",
    "programs.manage",
    "courses.manage",
    "courses.publish",
    "assignments.manage",
    "assignments.grade",
    "sessions.read_tenant",
    "sessions.observe",
    "reports.read_tenant",
    "libraries.manage",
    "libraries.publish",
    "libraries.approve",
    "analytics.read",
    "analytics.executive",
    "certificates.issue",
    "research.read",
    "research.manage",
    "research.export",
    "security.audit",
    "security.manage",
    "webhooks.manage",
    "integrations.manage",
    "observability.read",
    "support.impersonate_readonly",
  ],
  global_admin: [
    ...ALL_READ,
    "tenant.manage",
    "users.read",
    "users.manage",
    "programs.manage",
    "courses.manage",
    "courses.publish",
    "assignments.manage",
    "assignments.grade",
    "sessions.read_tenant",
    "sessions.observe",
    "reports.read_tenant",
    "libraries.manage",
    "libraries.publish",
    "libraries.approve",
    "analytics.read",
    "analytics.executive",
    "certificates.issue",
    "research.read",
    "research.manage",
    "research.export",
    "security.audit",
    "security.manage",
    "webhooks.manage",
    "integrations.manage",
    "observability.read",
  ],
  organization_admin: [
    ...ALL_READ,
    "tenant.manage",
    "users.read",
    "users.manage",
    "programs.manage",
    "courses.manage",
    "courses.publish",
    "assignments.manage",
    "assignments.grade",
    "sessions.read_tenant",
    "sessions.observe",
    "reports.read_tenant",
    "libraries.manage",
    "libraries.publish",
    "libraries.approve",
    "analytics.read",
    "analytics.executive",
    "certificates.issue",
    "research.read",
    "research.manage",
    "security.audit",
    "webhooks.manage",
    "integrations.manage",
    "observability.read",
  ],
  program_director: [
    ...ALL_READ,
    "users.read",
    "programs.manage",
    "courses.manage",
    "courses.publish",
    "assignments.manage",
    "assignments.grade",
    "sessions.read_tenant",
    "sessions.observe",
    "reports.read_tenant",
    "libraries.manage",
    "libraries.publish",
    "analytics.read",
    "certificates.issue",
    "research.read",
  ],
  supervisor: [
    ...ALL_READ,
    "users.read",
    "assignments.grade",
    "sessions.read_tenant",
    "sessions.observe",
    "reports.read_tenant",
    "analytics.read",
    "certificates.issue",
  ],
  faculty: [
    ...ALL_READ,
    "users.read",
    "courses.manage",
    "assignments.manage",
    "assignments.grade",
    "sessions.read_tenant",
    "sessions.observe",
    "reports.read_tenant",
    "libraries.manage",
    "analytics.read",
  ],
  research_coordinator: [
    ...ALL_READ,
    "users.read",
    "analytics.read",
    "research.read",
    "research.manage",
    "research.export",
    "libraries.read",
    "libraries.manage",
  ],
  support: [
    "tenant.read",
    "users.read",
    "programs.read",
    "courses.read",
    "sessions.read_own",
    "security.audit",
    "observability.read",
    "support.impersonate_readonly",
  ],
  resident: [
    ...ALL_READ,
    "sessions.read_own",
    "reports.read_own",
    "analytics.read",
  ],
  student: [...ALL_READ],
  therapist: [...ALL_READ],
  observer: [
    "tenant.read",
    "programs.read",
    "courses.read",
    "sessions.observe",
    "libraries.read",
    "certificates.verify",
  ],
  guest: ["tenant.read", "courses.read", "certificates.verify"],
};

/** Map Mission 18 / Stage 10 DB membership roles → EnterpriseRole. */
export function mapLegacyMembershipRole(
  role: LegacyMembershipRole | string,
): EnterpriseRole {
  switch (role) {
    case "institution_admin":
      return "organization_admin";
    case "instructor":
      return "faculty";
    case "psychologist":
    case "gp":
      return "therapist";
    case "program_director":
    case "faculty":
    case "supervisor":
    case "resident":
    case "student":
    case "observer":
    case "research_coordinator":
    case "guest":
    case "support":
    case "therapist":
      return role;
    default:
      return "guest";
  }
}

/** Platform admin (profiles.role = admin) elevates to global_admin. */
export function platformRoleToEnterprise(
  profileRole: "therapist" | "admin",
  membershipRole?: LegacyMembershipRole | string | null,
): EnterpriseRole {
  if (profileRole === "admin") return "global_admin";
  if (membershipRole) return mapLegacyMembershipRole(membershipRole);
  return "therapist";
}

export function permissionsFor(role: EnterpriseRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  role: EnterpriseRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(
  role: EnterpriseRole,
  permission: Permission,
): { ok: true } | { ok: false; reason: string } {
  if (hasPermission(role, permission)) return { ok: true };
  return {
    ok: false,
    reason: `Role ${role} lacks permission ${permission}`,
  };
}

/** Roles that may manage another tenant's data — only platform globals. */
export function isCrossTenantRole(role: EnterpriseRole): boolean {
  return role === "system_owner" || role === "global_admin";
}

export function listEnterpriseRoles(): EnterpriseRole[] {
  return Object.keys(ROLE_PERMISSIONS) as EnterpriseRole[];
}

export function rbacMatrix(): Array<{
  role: EnterpriseRole;
  permissions: Permission[];
}> {
  return listEnterpriseRoles().map((role) => ({
    role,
    permissions: [...ROLE_PERMISSIONS[role]],
  }));
}

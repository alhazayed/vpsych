/**
 * Enterprise RBAC matrix — platform + institution-scoped roles.
 */

import type {
  EnterpriseMembershipRole,
  PlatformRole,
} from "@/lib/enterprise/types";

export const ENTERPRISE_MEMBERSHIP_ROLES: EnterpriseMembershipRole[] = [
  "student",
  "resident",
  "psychologist",
  "gp",
  "faculty",
  "instructor",
  "program_director",
  "institution_admin",
];

export const LEARNER_ROLES: EnterpriseMembershipRole[] = [
  "student",
  "resident",
  "psychologist",
  "gp",
];

export const FACULTY_ROLES: EnterpriseMembershipRole[] = [
  "faculty",
  "instructor",
  "program_director",
  "institution_admin",
];

export const MANAGER_ROLES: EnterpriseMembershipRole[] = [
  "institution_admin",
  "program_director",
  "faculty",
  "instructor",
];

export type EnterprisePermission =
  | "institution.read"
  | "institution.write"
  | "membership.manage"
  | "class.manage"
  | "assignment.manage"
  | "assignment.complete"
  | "analytics.institution"
  | "analytics.class"
  | "research.export"
  | "feedback.write"
  | "curriculum.assign"
  | "osce.administer";

const ROLE_PERMISSIONS: Record<EnterpriseMembershipRole, EnterprisePermission[]> =
  {
    student: ["institution.read", "assignment.complete"],
    resident: ["institution.read", "assignment.complete"],
    psychologist: ["institution.read", "assignment.complete"],
    gp: ["institution.read", "assignment.complete"],
    faculty: [
      "institution.read",
      "class.manage",
      "assignment.manage",
      "analytics.class",
      "feedback.write",
      "curriculum.assign",
      "osce.administer",
    ],
    instructor: [
      "institution.read",
      "class.manage",
      "assignment.manage",
      "analytics.class",
      "feedback.write",
      "curriculum.assign",
      "osce.administer",
    ],
    program_director: [
      "institution.read",
      "membership.manage",
      "class.manage",
      "assignment.manage",
      "analytics.institution",
      "analytics.class",
      "feedback.write",
      "curriculum.assign",
      "osce.administer",
      "research.export",
    ],
    institution_admin: [
      "institution.read",
      "institution.write",
      "membership.manage",
      "class.manage",
      "assignment.manage",
      "analytics.institution",
      "analytics.class",
      "feedback.write",
      "curriculum.assign",
      "osce.administer",
      "research.export",
    ],
  };

/** Platform admin (profiles.role=admin) is Super Administrator — all permissions. */
export function isSuperAdministrator(platformRole: PlatformRole): boolean {
  return platformRole === "admin";
}

export function permissionsForRole(
  role: EnterpriseMembershipRole,
): EnterprisePermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function roleHasPermission(
  role: EnterpriseMembershipRole,
  permission: EnterprisePermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAct(
  platformRole: PlatformRole,
  membershipRoles: EnterpriseMembershipRole[],
  permission: EnterprisePermission,
): boolean {
  if (isSuperAdministrator(platformRole)) return true;
  return membershipRoles.some((r) => roleHasPermission(r, permission));
}

/** Map ACE profession strings onto enterprise membership roles. */
export function membershipRoleFromProfession(
  profession: string | null | undefined,
): EnterpriseMembershipRole {
  switch (profession) {
    case "medical_student":
    case "osce_candidate":
      return "student";
    case "psychiatry_resident":
    case "internal_medicine_resident":
      return "resident";
    case "psychologist":
    case "clinical_psychologist":
    case "counselor":
    case "social_worker":
      return "psychologist";
    case "general_practitioner":
    case "family_physician":
    case "emergency_physician":
    case "nurse_practitioner":
    case "psychiatric_nurse":
      return "gp";
    case "medical_educator":
      return "faculty";
    default:
      return "student";
  }
}

export function assertValidMembershipRole(
  role: string,
): role is EnterpriseMembershipRole {
  return (ENTERPRISE_MEMBERSHIP_ROLES as string[]).includes(role);
}

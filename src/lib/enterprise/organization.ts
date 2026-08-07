/**
 * Organization hierarchy — Stage 10.
 * Organization ≡ institutions row (Mission 18). Adds Campus layer.
 */

import type {
  Campus,
  DepartmentNode,
  Organization,
  OrgHierarchy,
  ProgramNode,
  TenantType,
} from "@/lib/enterprise/types";
import { isTenantType } from "@/lib/enterprise/tenant";

export function normalizeTenantType(
  settings: Record<string, unknown> | null | undefined,
  fallback: TenantType = "university",
): TenantType {
  const archetype = settings?.archetype ?? settings?.tenant_type;
  if (typeof archetype === "string" && isTenantType(archetype)) return archetype;
  if (archetype === "teaching_hospital") return "hospital";
  if (archetype === "private_institution") return "private_organization";
  if (archetype === "government_program") return "government";
  return fallback;
}

export function organizationFromInstitutionRow(row: {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
  country_code?: string;
  timezone?: string;
  locale_default?: string;
  sso_enabled?: boolean;
  sso_provider?: string | null;
  is_active?: boolean;
  settings?: Record<string, unknown> | null;
  tenant_type?: string | null;
}): Organization {
  const settings = (row.settings ?? {}) as Record<string, unknown>;
  const tenantType =
    row.tenant_type && isTenantType(row.tenant_type)
      ? row.tenant_type
      : normalizeTenantType(settings);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    legal_name: row.legal_name ?? null,
    tenant_type: tenantType,
    country_code: row.country_code ?? "US",
    timezone: row.timezone ?? "UTC",
    locale_default: row.locale_default ?? "en-US",
    sso_enabled: Boolean(row.sso_enabled),
    sso_provider: row.sso_provider ?? null,
    is_active: row.is_active !== false,
    settings,
  };
}

export function buildOrgHierarchy(opts: {
  organization: Organization;
  campuses?: Campus[];
  departments?: DepartmentNode[];
  programs?: ProgramNode[];
}): OrgHierarchy {
  return {
    organization: opts.organization,
    campuses: opts.campuses ?? [],
    departments: opts.departments ?? [],
    programs: opts.programs ?? [],
  };
}

export function hierarchySummary(h: OrgHierarchy): {
  organization_id: string;
  tenant_type: TenantType;
  campus_count: number;
  department_count: number;
  program_count: number;
} {
  return {
    organization_id: h.organization.id,
    tenant_type: h.organization.tenant_type,
    campus_count: h.campuses.length,
    department_count: h.departments.length,
    program_count: h.programs.length,
  };
}

/** Nodes in the required Stage 10 hierarchy label set. */
export const HIERARCHY_LABELS = [
  "Organization",
  "Campus",
  "Department",
  "Training Program",
  "Course",
  "Instructor",
  "Supervisor",
  "Resident",
  "Student",
  "Therapist",
  "Observer",
  "Researcher",
  "Administrator",
] as const;

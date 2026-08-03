import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-audit";
import type { Profile } from "@/lib/types";
import {
  canPermissionOnInstitution,
  type TenantContext,
} from "@/lib/enterprise/tenant";
import type {
  EnterpriseMembershipRole,
  InstitutionMembership,
  PlatformRole,
} from "@/lib/enterprise/types";
import type { EnterprisePermission } from "@/lib/enterprise/roles";
import { FACULTY_ROLES } from "@/lib/enterprise/roles";

export type ApiAuthContext = {
  supabase: SupabaseClient;
  user: User;
  profile: Profile;
};

export type ApiAuthResult =
  | { ok: true; supabase: SupabaseClient; user: User; profile: Profile }
  | { ok: false; response: NextResponse };

export type InstitutionAuthResult =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: User;
      profile: Profile;
      tenant: TenantContext;
      institutionId: string;
    }
  | { ok: false; response: NextResponse };

/**
 * Authenticated Route Handler guard (JSON 401 — never redirects).
 */
export async function requireApiUser(
  request?: Request,
): Promise<ApiAuthResult> {
  void request;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    supabase,
    user,
    profile: profile as Profile,
  };
}

/**
 * Admin Route Handler guard (JSON 403 + security audit on deny).
 */
export async function requireApiAdmin(
  request?: Request,
  opts?: { action?: string; resourceType?: string; resourceId?: string },
): Promise<ApiAuthResult> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;

  if (auth.profile.role !== "admin") {
    await logSecurityEvent({
      action: opts?.action ?? "admin.access",
      outcome: "denied",
      resourceType: opts?.resourceType ?? "api",
      resourceId: opts?.resourceId ?? null,
      metadata: { role: auth.profile.role },
      request,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}

/** Load active institution memberships for the caller. */
export async function loadTenantContext(
  supabase: SupabaseClient,
  userId: string,
  platformRole: PlatformRole,
): Promise<TenantContext> {
  const { data } = await supabase
    .from("institution_memberships")
    .select(
      "id, institution_id, user_id, role, department_id, program_id, cohort_id, is_primary, is_active",
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  return {
    platformRole,
    memberships: (data ?? []) as InstitutionMembership[],
  };
}

/**
 * Membership-aware institutional permission guard.
 * Platform admins (profiles.role=admin) always pass.
 * Faculty / PD / institution_admin pass when membership grants `permission`.
 */
export async function requireInstitutionPermission(
  request: Request,
  opts: {
    permission: EnterprisePermission;
    institutionId: string;
    action?: string;
    resourceType?: string;
  },
): Promise<InstitutionAuthResult> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;

  const institutionId = opts.institutionId?.trim();
  if (!institutionId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "institution_id required" },
        { status: 400 },
      ),
    };
  }

  const tenant = await loadTenantContext(
    auth.supabase,
    auth.user.id,
    auth.profile.role as PlatformRole,
  );

  if (!canPermissionOnInstitution(tenant, institutionId, opts.permission)) {
    await logSecurityEvent({
      action: opts.action ?? "institution.access",
      outcome: "denied",
      resourceType: opts.resourceType ?? "institution",
      resourceId: institutionId,
      metadata: {
        permission: opts.permission,
        role: auth.profile.role,
      },
      request,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    supabase: auth.supabase,
    user: auth.user,
    profile: auth.profile,
    tenant,
    institutionId,
  };
}

/** True when the user has any faculty-side membership (or is platform admin). */
export function hasFacultyAccess(tenant: TenantContext): boolean {
  if (tenant.platformRole === "admin") return true;
  return tenant.memberships.some(
    (m) =>
      m.is_active &&
      (FACULTY_ROLES as EnterpriseMembershipRole[]).includes(m.role),
  );
}

/** Consistent JSON error envelope for Route Handlers. */
export function apiError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extra }, { status });
}

import { NextResponse } from "next/server";
import {
  hasFacultyAccess,
  loadTenantContext,
  requireApiUser,
  requireInstitutionPermission,
} from "@/lib/api-auth";
import { getBuiltinInstitutionTree } from "@/lib/enterprise/catalog";
import { institutionsForUser } from "@/lib/enterprise/tenant";
import type { PlatformRole } from "@/lib/enterprise/types";
import { logSecurityEvent } from "@/lib/security-audit";

export const dynamic = "force-dynamic";

/**
 * Faculty / institution-admin: list institutions the caller can access.
 * Platform admins see all DB institutions (fallback to builtin demo tree).
 */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const tenant = await loadTenantContext(
    auth.supabase,
    auth.user.id,
    auth.profile.role as PlatformRole,
  );

  if (!hasFacultyAccess(tenant)) {
    await logSecurityEvent({
      action: "faculty.institutions.list",
      outcome: "denied",
      resourceType: "institutions",
      request,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("institutions")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    const tree = getBuiltinInstitutionTree();
    return NextResponse.json({
      institutions: [tree.institution],
      memberships: tenant.memberships,
      source: "builtin",
      warning: error.message,
    });
  }

  let institutions = data ?? [];
  if (auth.profile.role !== "admin") {
    const allowed = new Set(institutionsForUser(tenant));
    institutions = institutions.filter((i) => allowed.has(i.id as string));
  }

  return NextResponse.json({
    institutions,
    memberships: tenant.memberships,
    source: "database",
  });
}

/** Faculty dashboard rollup for one institution. */
export async function POST(request: Request) {
  let body: { institution_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const institutionId = String(body.institution_id ?? "").trim();
  const auth = await requireInstitutionPermission(request, {
    permission: "analytics.class",
    institutionId,
    action: "faculty.dashboard",
    resourceType: "institution",
  });
  if (!auth.ok) return auth.response;

  const [{ data: memberships }, { data: assignments }, { data: learners }] =
    await Promise.all([
      auth.supabase
        .from("institution_memberships")
        .select("id, user_id, role, cohort_id, is_active")
        .eq("institution_id", institutionId)
        .eq("is_active", true)
        .limit(500),
      auth.supabase
        .from("learning_assignments")
        .select("*")
        .eq("institution_id", institutionId)
        .order("due_at", { ascending: true })
        .limit(100),
      auth.supabase
        .from("learner_profiles")
        .select(
          "id, user_id, training_level, profession, institution, institution_id, certification_status, completed_case_count, confidence_score, updated_at",
        )
        .eq("institution_id", institutionId)
        .order("updated_at", { ascending: false })
        .limit(200),
    ]);

  const learnerRoles = new Set([
    "student",
    "resident",
    "psychologist",
    "gp",
  ]);
  const facultyCount = (memberships ?? []).filter(
    (m) => !learnerRoles.has(String(m.role)),
  ).length;
  const learnerCount = (memberships ?? []).filter((m) =>
    learnerRoles.has(String(m.role)),
  ).length;

  return NextResponse.json({
    institution_id: institutionId,
    summary: {
      membership_count: (memberships ?? []).length,
      faculty_count: facultyCount,
      learner_count: learnerCount || (learners ?? []).length,
      assignment_count: (assignments ?? []).length,
      published_assignments: (assignments ?? []).filter(
        (a) => a.status === "published",
      ).length,
    },
    assignments: assignments ?? [],
    learners: learners ?? [],
    memberships: memberships ?? [],
  });
}

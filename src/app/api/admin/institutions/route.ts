import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { getBuiltinInstitutionTree } from "@/lib/enterprise/catalog";
import { canPermissionOnInstitution } from "@/lib/enterprise/tenant";
import type { InstitutionMembership } from "@/lib/enterprise/types";

export const dynamic = "force-dynamic";

/**
 * List institutions (platform admin) or return builtin tree for offline.
 * Institution admins should query via membership-scoped selects in DB.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.institutions.list",
    resourceType: "institutions",
  });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("institutions")
    .select("*")
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    // Migration may not be applied yet — fall back to builtin demo tree.
    const tree = getBuiltinInstitutionTree();
    return NextResponse.json({
      institutions: [tree.institution],
      source: "builtin",
      warning: error.message,
    });
  }

  return NextResponse.json({
    institutions: data ?? [],
    source: "database",
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.institutions.create",
    resourceType: "institutions",
  });
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!slug || !name) {
    return NextResponse.json(
      { error: "slug and name are required" },
      { status: 400 },
    );
  }

  const { data, error } = await auth.supabase
    .from("institutions")
    .insert({
      slug,
      name,
      legal_name: body.legal_name ?? null,
      country_code: body.country_code ?? "US",
      timezone: body.timezone ?? "UTC",
      locale_default: body.locale_default ?? "en-US",
      sso_enabled: Boolean(body.sso_enabled),
      sso_provider: body.sso_provider ?? null,
      sso_metadata: body.sso_metadata ?? {},
      settings: body.settings ?? {},
      is_active: body.is_active !== false,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ institution: data }, { status: 201 });
}

/** Helper exported for tests — membership-gated institution analytics access. */
export function assertInstitutionAnalyticsAccess(
  platformRole: "therapist" | "admin",
  memberships: InstitutionMembership[],
  institutionId: string,
) {
  return canPermissionOnInstitution(
    { platformRole, memberships },
    institutionId,
    "analytics.institution",
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  buildEnterpriseAdminOverview,
  listEnterpriseBundles,
  runEnterpriseEngine,
} from "@/lib/enterprise";

/**
 * GET /api/enterprise/summary — member enterprise façade (tenant-scoped).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(
    `ent-summary:${user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("primary_institution_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const organizationId =
      (profile?.primary_institution_id as string | null) ?? null;

    let bundles = organizationId
      ? listEnterpriseBundles(organizationId)
      : [];
    let latest = bundles[bundles.length - 1] ?? null;

    if (!latest && organizationId) {
      latest = runEnterpriseEngine({
        organization_id: organizationId,
        user_id: user.id,
        profile_role: profile?.role === "admin" ? "admin" : "therapist",
        overall: 50,
        session_count: 0,
      });
      bundles = [latest];
    }

    const overview = organizationId
      ? buildEnterpriseAdminOverview({
          organization_id: organizationId,
          bundles,
        })
      : null;

    return NextResponse.json({
      ok: true,
      organizationId,
      overview,
      dashboard: latest?.dashboard ?? null,
      longitudinal: latest?.longitudinal ?? null,
      role: latest?.context.membership_role ?? null,
      disclaimer:
        "Tenant-scoped formative view. Reports remain admin-only. Enterprise never modifies patient state.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Enterprise summary unavailable",
          e instanceof Error ? e : null,
        ),
      },
      { status: 500 },
    );
  }
}

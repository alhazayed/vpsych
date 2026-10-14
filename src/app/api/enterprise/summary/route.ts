import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  buildEnterpriseAdminOverview,
  listEnterpriseBundles,
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
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("primary_institution_id, role")
      .eq("id", user.id)
      .maybeSingle();
    // A failed read is not "no organization".
    if (profileError) throw new Error(`profile read: ${profileError.message}`);

    const organizationId =
      (profile?.primary_institution_id as string | null) ?? null;

    const bundles = organizationId
      ? listEnterpriseBundles(organizationId)
      : [];
    // No sessions yet means no dashboard. A made-up one (overall 50) would
    // read as a real result.
    const latest = bundles[bundles.length - 1] ?? null;

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
      empty: latest === null,
      dashboard: latest?.dashboard ?? null,
      longitudinal: latest?.longitudinal ?? null,
      role: latest?.context.membership_role ?? null,
      disclaimer:
        "Tenant-scoped formative view. Reports remain admin-only. Enterprise never modifies patient state.",
    });
  } catch (e) {
    console.error("[enterprise/summary] failed", {
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    });
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

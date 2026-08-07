import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  ANALYTICS_SCOPES,
  ENTERPRISE_OWNERSHIP_RULE,
  ENTERPRISE_VERSION,
  HIERARCHY_LABELS,
  PERFORMANCE_ENVELOPE,
  TENANT_TYPES,
  buildAnalyticsDashboard,
  buildEnterpriseAdminOverview,
  buildObservabilitySnapshot,
  buildSecurityDashboard,
  defaultAuthPolicy,
  integrationCatalog,
  listEnterpriseBundles,
  listEnterpriseRoles,
  rbacMatrix,
} from "@/lib/enterprise";

/**
 * GET /api/admin/enterprise — enterprise platform overview.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.enterprise.dashboard",
    resourceType: "enterprise",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-enterprise:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const url = new URL(request.url);
    const organizationId =
      url.searchParams.get("organizationId") ??
      "b1000000-0000-4000-8000-000000000001";

    const bundles = listEnterpriseBundles(organizationId);
    const overview = buildEnterpriseAdminOverview({
      organization_id: organizationId,
      bundles,
    });
    const policy = defaultAuthPolicy(organizationId);
    const security = buildSecurityDashboard({
      organization_id: organizationId,
      policy,
      audits: [],
      isolation_ok: true,
    });
    const analytics = buildAnalyticsDashboard({
      organization_id: organizationId,
      scope: "executive",
      session_count: bundles.length,
      active_learners: Math.max(1, bundles.length),
      mean_overall:
        bundles.reduce(
          (a, b) => a + (b.dashboard?.kpis.find((k) => k.id === "mean_overall")?.value ?? 0),
          0,
        ) / Math.max(1, bundles.length),
    });
    const observability = buildObservabilitySnapshot({
      latencies_ms: [120, 180, 220, 300],
      requests: 4,
      failures: 0,
      active_sessions: 1,
    });

    return NextResponse.json({
      ok: true,
      enterprise_version: ENTERPRISE_VERSION,
      ownership: ENTERPRISE_OWNERSHIP_RULE,
      tenant_types: TENANT_TYPES,
      hierarchy_labels: HIERARCHY_LABELS,
      roles: listEnterpriseRoles(),
      rbac: rbacMatrix().map((r) => ({
        role: r.role,
        permission_count: r.permissions.length,
      })),
      analytics_scopes: ANALYTICS_SCOPES,
      performance_envelope: PERFORMANCE_ENVELOPE,
      integrations: integrationCatalog(),
      overview,
      analytics,
      security,
      observability,
      disclaimer:
        "Enterprise tenancy and formative analytics only. Never modifies patient cognition. Competency scores are not validated clinical instruments.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Admin enterprise unavailable",
          e instanceof Error ? e : null,
        ),
      },
      { status: 500 },
    );
  }
}

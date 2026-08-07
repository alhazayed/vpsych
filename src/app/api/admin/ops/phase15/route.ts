import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { buildPhase15Readiness } from "@/lib/ops/phase15-readiness";
import { buildProductionOpsSnapshot } from "@/lib/ops";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ops/phase15 — Final GA authorization evidence package.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.phase15",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-phase15:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          ...requestIdHeaders(requestId),
        },
      },
    );
  }

  try {
    const ops = buildProductionOpsSnapshot();

    let openCritical = 0;
    try {
      const feedbackCriticalRes = await auth.supabase
        .from("institutional_feedback")
        .select("id", { count: "exact", head: true })
        .eq("severity", "critical")
        .not("status", "in", '("resolved","wont_fix","duplicate")');
      openCritical = feedbackCriticalRes.count ?? 0;
    } catch {
      openCritical = 0;
    }

    const pack = buildPhase15Readiness({
      open_critical_feedback: openCritical,
      trends: [
        {
          t: new Date().toISOString().slice(0, 10),
          platform_availability: ops.health.liveness === "ok" ? 100 : 90,
          critical_incident_rate: openCritical,
        },
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        ...pack,
        ops_health: ops.health,
        phase14_path: "/api/admin/ops/phase14",
        cidp_path: "/api/admin/ops/cidp",
        disclaimer:
          "Phase 15 final GA authorization package. Empty DR/PITR/pilot evidence keeps GA at NO-GO. Clinical Core unchanged. Competency scores are not validated.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
          ...requestIdHeaders(requestId),
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Unable to build Phase 15 readiness package",
          err instanceof Error ? err : null,
        ),
      },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

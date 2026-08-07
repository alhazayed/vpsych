import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { buildCidpDashboards } from "@/lib/ops/cidp-dashboards";
import { buildProductionOpsSnapshot } from "@/lib/ops";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ops/cidp — Controlled Institutional Deployment dashboards.
 * Counts only; soft-fails to zeros when tables are empty or unavailable.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.cidp",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-cidp:${auth.user.id}`,
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

    const [
      completedRes,
      abandonedRes,
      institutionsRes,
      campusesRes,
      departmentsRes,
      auditRes,
      feedbackCriticalRes,
    ] = await Promise.all([
      auth.supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      auth.supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "expired"),
      auth.supabase
        .from("institutions")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("enterprise_campuses")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("departments")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("security_audit_events")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("institutional_feedback")
        .select("id", { count: "exact", head: true })
        .eq("severity", "critical")
        .neq("status", "resolved"),
    ]);

    const dashboards = buildCidpDashboards({
      uptime_ratio: ops.health.liveness === "ok" ? 1 : 0.9,
      api_latency_p50_ms: ops.enterprise.api_latency_p50_ms,
      api_latency_p95_ms: ops.enterprise.api_latency_p95_ms,
      sse_p95_ms: ops.realtime.metrics.avgLatencyMs ?? 0,
      voice_e2e_p95_ms: ops.latency_budgets.voice_e2e_p95_target_ms,
      queue_depth: ops.enterprise.queue_depth,
      simulations_completed: completedRes.count ?? 0,
      simulations_abandoned: abandonedRes.count ?? 0,
      assessments_completed: completedRes.count ?? 0,
      institutions: institutionsRes.count ?? 0,
      campuses: campusesRes.count ?? 0,
      departments: departmentsRes.count ?? 0,
      audit_events: auditRes.count ?? 0,
      auth_failures: 0,
      rbac_violations: 0,
      rate_limit_hits: 0,
      datasets: 0,
      validation_runs: 0,
      inter_rater_agreement: 0,
      realism_score_mean: 0,
      active_residents: 0,
      active_faculty: 0,
      dau: ops.enterprise.active_sessions,
      wau: ops.enterprise.active_sessions,
    });

    return NextResponse.json(
      {
        ...dashboards,
        ops_health: ops.health,
        open_critical_feedback: feedbackCriticalRes.count ?? 0,
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
          "Unable to build CIDP dashboards",
          err instanceof Error ? err : null,
        ),
      },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

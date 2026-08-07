import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { buildCidpDashboards } from "@/lib/ops/cidp-dashboards";
import { buildCidpSuccessMetrics } from "@/lib/ops/cidp-success-metrics";
import { emptyPilotPortfolio } from "@/lib/ops/cidp-pilot";
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
      activeRes,
      institutionsRes,
      campusesRes,
      departmentsRes,
      auditRes,
      feedbackCriticalRes,
      feedbackHighRes,
      feedbackResolvedRes,
      feedbackTotalRes,
      deniedAuditRes,
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
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
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
        .not("status", "in", '("resolved","wont_fix","duplicate")'),
      auth.supabase
        .from("institutional_feedback")
        .select("id", { count: "exact", head: true })
        .eq("severity", "high")
        .not("status", "in", '("resolved","wont_fix","duplicate")'),
      auth.supabase
        .from("institutional_feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "resolved"),
      auth.supabase
        .from("institutional_feedback")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("security_audit_events")
        .select("id", { count: "exact", head: true })
        .eq("outcome", "denied"),
    ]);

    const completed = completedRes.count ?? 0;
    const abandoned = abandonedRes.count ?? 0;
    const active = activeRes.count ?? 0;
    const started = completed + abandoned + active;
    const failureRate = ops.enterprise.failure_rate ?? 0;
    const pilots = emptyPilotPortfolio();

    const dashboards = buildCidpDashboards({
      uptime_ratio: ops.health.liveness === "ok" ? 1 : 0.9,
      api_latency_p50_ms: ops.enterprise.api_latency_p50_ms,
      api_latency_p95_ms: ops.enterprise.api_latency_p95_ms,
      sse_p95_ms: ops.realtime.metrics.avgLatencyMs ?? 0,
      voice_e2e_p95_ms: ops.latency_budgets.voice_e2e_p95_target_ms,
      queue_depth: ops.enterprise.queue_depth,
      error_rate: failureRate,
      simulations_started: started,
      simulations_completed: completed,
      simulations_abandoned: abandoned,
      assessments_completed: completed,
      institutions: institutionsRes.count ?? 0,
      campuses: campusesRes.count ?? 0,
      departments: departmentsRes.count ?? 0,
      audit_events: auditRes.count ?? 0,
      rbac_violations: deniedAuditRes.count ?? 0,
      auth_failures: 0,
      rate_limit_hits: 0,
      security_alerts: 0,
      feedback_total: feedbackTotalRes.count ?? 0,
      feedback_open_critical: feedbackCriticalRes.count ?? 0,
      feedback_open_high: feedbackHighRes.count ?? 0,
      feedback_resolved: feedbackResolvedRes.count ?? 0,
      pilots_active: pilots.by_status.active ?? 0,
      pilots_planned: pilots.by_status.planned ?? 0,
      support_requests: 0,
      datasets: 0,
      validation_runs: 0,
      inter_rater_agreement: 0,
      realism_score_mean: 0,
      publication_datasets: 0,
      active_residents: 0,
      active_faculty: 0,
      dau: ops.enterprise.active_sessions,
      wau: ops.enterprise.active_sessions,
    });

    const success = buildCidpSuccessMetrics({
      pilots_total: Math.max(1, pilots.pilots || 1),
      pilots_deployed_ok: pilots.pilots,
      uptime_ratio: ops.health.liveness === "ok" ? 1 : 0.9,
      api_latency_p95_ms: ops.enterprise.api_latency_p95_ms,
      simulations_started: started,
      simulations_completed: completed,
      error_rate: failureRate,
      institutions: institutionsRes.count ?? 0,
    });

    return NextResponse.json(
      {
        ...dashboards,
        ops_health: ops.health,
        open_critical_feedback: feedbackCriticalRes.count ?? 0,
        open_high_feedback: feedbackHighRes.count ?? 0,
        success_metrics: success,
        pilots,
        ga_status: "NO-GO",
        cidp_status: "GO",
        weekly_reports_path: "/api/admin/ops/cidp/weekly",
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

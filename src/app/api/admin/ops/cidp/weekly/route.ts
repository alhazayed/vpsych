import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { buildCidpDashboards } from "@/lib/ops/cidp-dashboards";
import { buildCidpSuccessMetrics } from "@/lib/ops/cidp-success-metrics";
import { emptyPilotPortfolio } from "@/lib/ops/cidp-pilot";
import { buildWeeklyReports } from "@/lib/ops/cidp-weekly-reports";
import { buildProductionOpsSnapshot } from "@/lib/ops";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ops/cidp/weekly — weekly executive/clinical/security reports.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.cidp.weekly",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-cidp-weekly:${auth.user.id}`,
    30,
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
    const url = new URL(request.url);
    const weekEnding =
      url.searchParams.get("weekEnding") ??
      new Date().toISOString().slice(0, 10);

    const [
      completedRes,
      abandonedRes,
      activeRes,
      feedbackCritical,
      feedbackHigh,
      feedbackResolved,
      feedbackTotal,
      institutionsRes,
      auditRes,
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
        .from("institutions")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("security_audit_events")
        .select("id", { count: "exact", head: true }),
    ]);

    const completed = completedRes.count ?? 0;
    const abandoned = abandonedRes.count ?? 0;
    const active = activeRes.count ?? 0;
    const started = completed + abandoned + active;
    const failureRate = ops.enterprise.failure_rate ?? 0;

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
      audit_events: auditRes.count ?? 0,
      feedback_total: feedbackTotal.count ?? 0,
      feedback_open_critical: feedbackCritical.count ?? 0,
      feedback_open_high: feedbackHigh.count ?? 0,
      feedback_resolved: feedbackResolved.count ?? 0,
      dau: ops.enterprise.active_sessions,
      wau: ops.enterprise.active_sessions,
    });

    const pilots = emptyPilotPortfolio();
    const success = buildCidpSuccessMetrics({
      pilots_total: Math.max(1, pilots.pilots),
      pilots_deployed_ok: pilots.pilots,
      uptime_ratio: ops.health.liveness === "ok" ? 1 : 0.9,
      api_latency_p95_ms: ops.enterprise.api_latency_p95_ms,
      simulations_started: started,
      simulations_completed: completed,
      error_rate: failureRate,
      institutions: institutionsRes.count ?? 0,
    });

    const reports = buildWeeklyReports({
      week_ending: weekEnding,
      dashboards,
      success,
      pilots,
      open_critical_feedback: feedbackCritical.count ?? 0,
      open_high_feedback: feedbackHigh.count ?? 0,
      notes: [
        "Pilot registry empty until institutions are onboarded via checklist.",
      ],
    });

    return NextResponse.json(
      {
        week_ending: weekEnding,
        ga_status: "NO-GO",
        cidp_status: "GO",
        success,
        pilots,
        reports,
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
          "Unable to build weekly CIDP reports",
          err instanceof Error ? err : null,
        ),
      },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

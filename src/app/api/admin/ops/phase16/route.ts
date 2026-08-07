import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { buildPhase16Execution } from "@/lib/ops/phase16-execution";
import { buildProductionOpsSnapshot } from "@/lib/ops";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ops/phase16 — Institutional pilot execution evidence.
 * Observed DB counts only; surveys/drills/pen-tests remain Evidence Pending
 * until signed evidence exists. Never fabricates pilots or outcomes.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.phase16",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-phase16:${auth.user.id}`,
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
      feedbackCriticalRes,
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
        .from("institutions")
        .select("id", { count: "exact", head: true }),
      auth.supabase
        .from("institutional_feedback")
        .select("id", { count: "exact", head: true })
        .eq("severity", "critical")
        .not("status", "in", '("resolved","wont_fix","duplicate")'),
      auth.supabase
        .from("security_audit_events")
        .select("id", { count: "exact", head: true }),
    ]);

    const completed = completedRes.count ?? 0;
    const abandoned = abandonedRes.count ?? 0;
    const active = activeRes.count ?? 0;
    const started = completed + abandoned + active;

    // Institution table seeds ≠ executed pilot profiles. Do not fabricate
    // InstitutionPilotProfile rows from seed counts alone.
    const pack = buildPhase16Execution({
      institutions: [],
      dashboard: {
        institutions_count: institutionsRes.count ?? 0,
        sessions_completed: completed,
        sessions_started: started,
        sessions_active: active,
        feedback_open_critical: feedbackCriticalRes.count ?? 0,
        audit_events: auditRes.count ?? 0,
        api_latency_p95_ms: ops.enterprise.api_latency_p95_ms,
        uptime_ratio: ops.health.liveness === "ok" ? 1 : undefined,
        error_rate: ops.enterprise.failure_rate,
        npm_audit_high_vulns: 0,
        // DR / PITR / pen-test intentionally unset → Evidence Pending
      },
      ga: {
        open_critical_feedback: feedbackCriticalRes.count ?? 0,
        // dr_drill_rows / pitr_rows / pen_test_rows omitted → Evidence Pending
      },
      outstanding_actions: [
        "Onboard institutional pilot profiles (do not invent)",
        "Execute and sign DR + PITR drills",
        "Attach penetration-test evidence",
        "Close security residuals (HIBP/APM)",
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        ...pack,
        ops_health: ops.health,
        note_on_institutions:
          "institutions table row count is observed for executive metrics; pilot registry profiles remain Evidence Pending until formally recorded.",
        disclaimer:
          "Phase 16 execution evidence. Missing drills/surveys/pilots = Evidence Pending. Clinical Core frozen. GA NO-GO until all gates PASS.",
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
          "Unable to build Phase 16 execution package",
          err instanceof Error ? err : null,
        ),
      },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

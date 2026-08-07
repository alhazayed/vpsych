import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { buildPhase14Readiness } from "@/lib/ops/phase14-readiness";
import { buildProductionOpsSnapshot } from "@/lib/ops";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ops/phase14 — Global Institutional Pilot / GA readiness package.
 * Ops evidence only; never exposes PHI or session_reports narrative.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.phase14",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-phase14:${auth.user.id}`,
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
    ]);

    const completed = completedRes.count ?? 0;
    const abandoned = abandonedRes.count ?? 0;
    const active = activeRes.count ?? 0;
    const started = completed + abandoned + active;
    const institutions = institutionsRes.count ?? 0;
    const openCritical = feedbackCriticalRes.count ?? 0;

    const pack = buildPhase14Readiness({
      gates: {
        open_critical_feedback: openCritical,
      },
      clinical: {
        simulations_started: started,
        simulations_completed: completed,
        simulations_abandoned: abandoned,
      },
      research: {
        multicenter_sites: institutions,
      },
      trends: [
        {
          t: new Date().toISOString().slice(0, 10),
          institution_adoption: institutions,
          session_completion:
            started === 0 ? 0 : Math.round((completed / started) * 1000) / 10,
          platform_availability: ops.health.liveness === "ok" ? 100 : 90,
          critical_incident_rate: openCritical,
          security_events: 0,
          research_participation: institutions,
        },
      ],
    });

    return NextResponse.json(
      {
        ok: true,
        ...pack,
        ops_health: ops.health,
        cidp_dashboard_path: "/api/admin/ops/cidp",
        weekly_reports_path: "/api/admin/ops/cidp/weekly",
        disclaimer:
          "Phase 14 operational evidence package. Competency scores are not validated. GA remains NO-GO until all gates PASS and Release Board authorizes v1.0.0.",
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
          "Unable to build Phase 14 readiness package",
          err instanceof Error ? err : null,
        ),
      },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

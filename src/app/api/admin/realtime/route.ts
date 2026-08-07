import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  REALTIME_E2E_VOICE_TURN_P50_MS,
  REALTIME_E2E_VOICE_TURN_P95_MS,
  REALTIME_INTERACTION_LATENCY_TARGET_MS,
  REALTIME_OWNERSHIP_RULE,
  REALTIME_VERSION,
  buildRealtimeDashboard,
  createRealtimeMetricsStore,
  isRealtimeSimulationEnabled,
  isRealtimeStreamingEnabled,
} from "@/lib/realtime";

/**
 * GET /api/admin/realtime — realtime platform observability overview.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.realtime.dashboard",
    resourceType: "realtime",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-realtime:${auth.user.id}`,
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
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    const store = createRealtimeMetricsStore();
    const dashboard = buildRealtimeDashboard({ sessionId });

    return NextResponse.json({
      ok: true,
      version: REALTIME_VERSION,
      ownership: REALTIME_OWNERSHIP_RULE,
      flags: {
        simulation: isRealtimeSimulationEnabled(),
        streaming: isRealtimeStreamingEnabled(),
      },
      budgets: {
        interactionTargetMs: REALTIME_INTERACTION_LATENCY_TARGET_MS,
        e2eP50Ms: REALTIME_E2E_VOICE_TURN_P50_MS,
        e2eP95Ms: REALTIME_E2E_VOICE_TURN_P95_MS,
      },
      dashboard,
      metrics: store.summary(sessionId),
      disclaimer:
        "Admin realtime observability. Never exposes session_reports to therapists. Never owns patient cognition.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Admin realtime dashboard failed",
          e instanceof Error ? e.message : null,
        ),
      },
      { status: 500 },
    );
  }
}

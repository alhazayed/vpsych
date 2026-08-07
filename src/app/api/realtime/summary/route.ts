import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  REALTIME_OWNERSHIP_RULE,
  buildRealtimeDashboard,
  createRealtimeMetricsStore,
  isRealtimeSimulationEnabled,
  runRealtimeEngine,
} from "@/lib/realtime";

/**
 * GET /api/realtime/summary — trainee realtime façade (presentation metrics).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(
    `rt-summary:${user.id}`,
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
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? `preview-${user.id}`;
    const enabled = isRealtimeSimulationEnabled();
    const bundle = runRealtimeEngine({
      sessionId,
      locale: url.searchParams.get("locale") ?? "en",
      waitingRoom: true,
    });
    const store = createRealtimeMetricsStore();
    const dashboard = buildRealtimeDashboard({ sessionId });

    return NextResponse.json({
      ok: true,
      enabled,
      ownership: REALTIME_OWNERSHIP_RULE,
      dashboard,
      session: bundle.session,
      avatar: bundle.avatar,
      multilingual: bundle.multilingual,
      accessibility: bundle.accessibility,
      quality: bundle.quality,
      metrics: store.summary(sessionId),
      disclaimer:
        "Presentation-layer realtime status. Reports remain admin-only. Realtime never modifies patient state.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: clientSafeError("Realtime summary failed", e),
      },
      { status: 500 },
    );
  }
}

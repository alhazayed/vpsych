import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { isHandsFreeTherapyEnabled } from "@/lib/conversation/feature-flag";
import { rateLimit } from "@/lib/rate-limit";

/** Admin aggregate HFTE metrics — no raw audio. */
export async function GET(request: Request) {
  if (!isHandsFreeTherapyEnabled()) {
    return NextResponse.json({ error: "HFTE disabled" }, { status: 404 });
  }

  const auth = await requireApiAdmin(request, {
    action: "admin.hfte.metrics",
    resourceType: "hfte_session_metrics",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-hfte:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await auth.supabase
    .from("hfte_session_metrics")
    .select(
      "session_id, interruption_count, pause_count, speech_duration_ms, thinking_latency_ms, turn_count, vad_confidence_avg, network_disconnect_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }

  const rows = data ?? [];
  const n = rows.length || 1;
  const totals = rows.reduce(
    (acc, r) => {
      acc.interruptions += r.interruption_count ?? 0;
      acc.pauses += r.pause_count ?? 0;
      acc.speech += r.speech_duration_ms ?? 0;
      acc.latency += r.thinking_latency_ms ?? 0;
      acc.turns += r.turn_count ?? 0;
      acc.vad += Number(r.vad_confidence_avg) || 0;
      return acc;
    },
    { interruptions: 0, pauses: 0, speech: 0, latency: 0, turns: 0, vad: 0 },
  );

  return NextResponse.json({
    sessions: rows.length,
    averages: {
      interruptionsPerSession: totals.interruptions / n,
      latencyMsPerSession: totals.latency / n,
      speechDurationMs: totals.speech / n,
      pauseFrequency: totals.pauses / n,
      vadConfidence: totals.vad / n,
      turnsPerSession: totals.turns / n,
    },
    recent: rows,
  });
}

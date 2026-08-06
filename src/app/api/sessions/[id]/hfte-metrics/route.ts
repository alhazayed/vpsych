import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { isHandsFreeTherapyEnabled } from "@/lib/conversation/feature-flag";
import { rateLimit } from "@/lib/rate-limit";

type Params = { params: Promise<{ id: string }> };

/**
 * Upsert aggregate HFTE metrics for a session.
 * Rejects any payload that looks like audio — transcript/metrics only.
 */
export async function POST(request: Request, { params }: Params) {
  if (!isHandsFreeTherapyEnabled()) {
    return NextResponse.json({ error: "HFTE disabled" }, { status: 404 });
  }

  const { id: sessionId } = await params;
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `hfte-metrics:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Security: never accept audio / recordings.
  for (const key of Object.keys(body)) {
    if (/audio|wav|recording|blob|base64|pcm/i.test(key)) {
      return NextResponse.json(
        { error: "Audio payloads are not accepted" },
        { status: 400 },
      );
    }
  }

  const { data: session } = await auth.supabase
    .from("sessions")
    .select("id, therapist_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.therapist_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = {
    session_id: sessionId,
    therapist_id: auth.user.id,
    interruption_count: Math.max(0, Number(body.interruption_count) || 0),
    pause_count: Math.max(0, Number(body.pause_count) || 0),
    speech_duration_ms: Math.max(0, Number(body.speech_duration_ms) || 0),
    thinking_latency_ms: Math.max(0, Number(body.thinking_latency_ms) || 0),
    turn_count: Math.max(0, Number(body.turn_count) || 0),
    vad_confidence_avg: Math.min(
      1,
      Math.max(0, Number(body.vad_confidence_avg) || 0),
    ),
    network_disconnect_count: Math.max(
      0,
      Number(body.network_disconnect_count) || 0,
    ),
    updated_at: new Date().toISOString(),
  };

  const { error } = await auth.supabase.from("hfte_session_metrics").upsert(row, {
    onConflict: "session_id",
  });

  if (error) {
    return NextResponse.json({ error: "Failed to save metrics" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

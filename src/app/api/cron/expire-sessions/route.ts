import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { expireStaleSessionsBatch } from "@/lib/session-expiry";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Scheduled session expiry maintenance endpoint.
 *
 * Endpoint: GET /api/cron/expire-sessions
 * Authentication: Authorization: Bearer $CRON_SECRET (fail-closed if unset)
 * Purpose: Expire active sessions past started_at + max_duration_sec.
 *
 * Application support: READY
 * Scheduler configuration: DEPLOYMENT RESPONSIBILITY
 * Production scheduler: NOT wired in vercel.json (Hobby rejects crons).
 * Configure an external scheduler or Vercel Cron (Pro+) to invoke this path.
 *
 * Does NOT run assessment or create reports. Idempotent (CAS on status=active).
 * Service role stays server-side; never exposed to clients.
 */
export async function GET(request: Request) {
  const authz = authorizeCronRequest(request);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const limited = await rateLimit("cron:expire-sessions", 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.warn("[cron/expire-sessions] service role unavailable");
    return NextResponse.json(
      { error: "Service role unavailable for maintenance" },
      { status: 503 },
    );
  }

  const started = Date.now();
  const limit = 200;
  console.info("[cron/expire-sessions] start", { limit });

  try {
    const result = await expireStaleSessionsBatch(supabase, new Date(), limit);
    const durationMs = Date.now() - started;
    console.info("[cron/expire-sessions] complete", {
      scanned: result.scanned,
      expired: result.expired,
      selectError: result.selectError ?? false,
      saturated: result.scanned >= limit,
      durationMs,
    });
    return NextResponse.json({
      ok: true,
      scanned: result.scanned,
      expired: result.expired,
      saturated: result.scanned >= limit,
    });
  } catch (err) {
    console.error("[cron/expire-sessions] failed", {
      durationMs: Date.now() - started,
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json(
      { error: "Expiry batch failed" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { expireStaleSessionsBatch } from "@/lib/session-expiry";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Scheduled session expiry (Vercel Cron).
 *
 * Auth: Authorization Bearer must match CRON_SECRET.
 * When CRON_SECRET is unset, the route refuses all callers (fail closed).
 *
 * Semantics: marks timed-out `active` sessions as `expired` using
 * started_at + max_duration_sec. Does not run assessment or create reports.
 * Idempotent; safe to invoke repeatedly.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Cron endpoint is not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json(
      { error: "Service role unavailable for maintenance" },
      { status: 503 },
    );
  }

  const result = await expireStaleSessionsBatch(supabase, new Date(), 200);
  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    expired: result.expired,
  });
}

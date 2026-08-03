import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public liveness/readiness probe for load balancers and institutional monitoring.
 * Does not require authentication. Does not expose secrets or provider errors.
 */
export async function GET() {
  const started = Date.now();
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const body = {
    status: "ok" as const,
    service: "vpsych",
    time: new Date().toISOString(),
    uptime_probe_ms: Math.max(0, Date.now() - started),
    checks: {
      app: true,
      supabase_env: supabaseConfigured,
    },
  };

  return NextResponse.json(body, {
    status: 200,
    headers: {
      "cache-control": "no-store",
    },
  });
}

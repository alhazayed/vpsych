import { NextResponse } from "next/server";

/**
 * Public liveness probe — no auth, no upstream I/O.
 * Used by load balancers, CI smoke tests, and SRE health checks.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "vpsych",
      checkedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

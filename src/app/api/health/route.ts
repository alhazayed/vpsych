import { NextResponse } from "next/server";

/**
 * Public liveness probe — no auth, no upstream I/O.
 * Used by load balancers and Mission 12 recovery checks.
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

import { NextResponse } from "next/server";

/**
 * Public liveness probe — no auth.
 * For load balancers / uptime monitors. Does not check dependencies.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "vpsych",
    checkedAt: new Date().toISOString(),
  });
}

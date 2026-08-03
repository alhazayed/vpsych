import { NextResponse } from "next/server";

/** Public liveness probe — no auth (institutional / load-balancer health checks). */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "vpsych",
    checkedAt: new Date().toISOString(),
  });
}

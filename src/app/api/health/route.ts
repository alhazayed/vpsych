import { NextResponse } from "next/server";
import { PACKAGE_VERSION, STAGE12_CERT_ID } from "@/lib/ops/versions";

/**
 * Public liveness probe — no auth, no upstream I/O.
 * Used by load balancers, CI smoke tests, and SRE health checks.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "vpsych",
      version: PACKAGE_VERSION,
      certId: STAGE12_CERT_ID,
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

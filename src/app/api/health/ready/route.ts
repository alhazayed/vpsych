import { NextResponse } from "next/server";
import {
  buildReadinessReport,
  httpStatusForReadiness,
} from "@/lib/ops/readiness";

export const dynamic = "force-dynamic";

/**
 * Public readiness probe — aggregated dependency status.
 * Returns 503 only when critical path (app/Supabase) is down.
 * Degraded vendor states still return 200 with status:"degraded".
 * Never leaks raw provider error strings.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const skipNetwork = url.searchParams.get("skipNetwork") === "1";

  const report = await buildReadinessReport({
    probeNetwork: !skipNetwork,
  });

  // Strip any accidental detail that looks like a provider stacktrace
  const safeChecks = report.checks.map((c) => ({
    id: c.id,
    status: c.status,
    latencyMs: c.latencyMs,
    detail: c.detail?.slice(0, 64) ?? null,
  }));

  return NextResponse.json(
    {
      status: report.status,
      checkedAt: report.checkedAt,
      checks: safeChecks,
      circuits: report.circuits,
      objectives: {
        rtoHours: report.objectives.rtoHours,
        rpoHours: report.objectives.rpoHours,
      },
    },
    {
      status: httpStatusForReadiness(report.status),
      headers: { "Cache-Control": "no-store" },
    },
  );
}

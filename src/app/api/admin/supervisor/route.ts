import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  THERAPIST_SKILL_DEFINITIONS,
  buildSupervisorDashboard,
  listSupervisorBundlesForUser,
  SUPERVISOR_OWNERSHIP_RULE,
  SUPERVISOR_VERSION,
} from "@/lib/supervisor";

/**
 * GET /api/admin/supervisor — admin supervisor overview.
 * Does not expose raw session_reports; uses in-memory supervisor bundles.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.supervisor.dashboard",
    resourceType: "supervisor_runs",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-supervisor:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const url = new URL(request.url);
    const learnerId = url.searchParams.get("learnerId");

    const bundles = learnerId
      ? listSupervisorBundlesForUser(learnerId)
      : [];

    const latest = bundles[bundles.length - 1] ?? null;
    const dashboard = buildSupervisorDashboard({
      bundle: latest,
      historyOveralls: bundles.map((b) => b.progress.overall_ema),
    });

    return NextResponse.json({
      ok: true,
      supervisor_version: SUPERVISOR_VERSION,
      ownership: SUPERVISOR_OWNERSHIP_RULE,
      skill_catalog: THERAPIST_SKILL_DEFINITIONS.map((d) => ({
        id: d.id,
        label: d.label,
        weight: d.weight,
        category: d.category,
      })),
      dashboard,
      n_bundles: bundles.length,
      disclaimer:
        "Educational supervision only. Competency scores are not validated clinical instruments. Supervisor never modifies patient state.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Admin supervisor unavailable",
          e instanceof Error ? e : null,
        ),
      },
      { status: 500 },
    );
  }
}

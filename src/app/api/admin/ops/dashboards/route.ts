import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import { buildGaDashboards } from "@/lib/ops";

export const dynamic = "force-dynamic";

/** Admin production dashboards — GA Controlled Institutional Deployment. */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.dashboards",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-dashboards:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          ...requestIdHeaders(requestId),
        },
      },
    );
  }

  return NextResponse.json(buildGaDashboards(), {
    headers: { "Cache-Control": "no-store", ...requestIdHeaders(requestId) },
  });
}

import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildProductionOpsSnapshot } from "@/lib/ops";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * Admin production ops dashboard — Stage 12.
 * Aggregates env posture, enterprise + realtime in-process metrics.
 */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.metrics",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-metrics:${auth.user.id}`,
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

  const snapshot = buildProductionOpsSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
      ...requestIdHeaders(requestId),
    },
  });
}

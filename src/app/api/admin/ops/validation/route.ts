import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import { runOperationalValidation } from "@/lib/ops";

export const dynamic = "force-dynamic";

/** Admin GA operational validation suite. */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.ops.validation",
    resourceType: "ops",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ops-validation:${auth.user.id}`,
    20,
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

  const url = new URL(request.url);
  const simulate = Number(url.searchParams.get("simulate") ?? 100);
  const result = runOperationalValidation({
    simulateSessions: Number.isFinite(simulate) ? simulate : 100,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store", ...requestIdHeaders(requestId) },
  });
}

import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import { feedbackSummary, listFeedback } from "@/lib/feedback";

export const dynamic = "force-dynamic";

/** Admin feedback dashboard — product feedback only. */
export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.feedback.list",
    resourceType: "institutional_feedback",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-feedback:${auth.user.id}`,
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

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 200);

  const memory = listFeedback(limit);
  const { data, error } = await auth.supabase
    .from("institutional_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 2000));

  return NextResponse.json(
    {
      summary: feedbackSummary(),
      memory,
      database: data ?? [],
      source: error || !data?.length ? "memory" : "database+memory",
      warning: error?.message,
      ownership: "Never writes patient clinical state",
    },
    { headers: { "Cache-Control": "no-store", ...requestIdHeaders(requestId) } },
  );
}

import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  summarizeFeedback,
  validateFeedbackAdminPatch,
} from "@/lib/enterprise/feedback";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/feedback — institutional feedback queue (admin).
 * PATCH /api/admin/feedback — triage status / priority.
 */
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
  const status = url.searchParams.get("status");
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100),
  );

  let query = auth.supabase
    .from("institutional_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Unable to list feedback", error) },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }

  const items = data ?? [];
  return NextResponse.json(
    {
      items,
      summary: summarizeFeedback(items),
    },
    {
      headers: {
        "Cache-Control": "no-store",
        ...requestIdHeaders(requestId),
      },
    },
  );
}

export async function PATCH(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiAdmin(request, {
    action: "admin.feedback.patch",
    resourceType: "institutional_feedback",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-feedback-patch:${auth.user.id}`,
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

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json(
        { error: "id required" },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    const patch = validateFeedbackAdminPatch(body);
    if (!patch.ok) {
      return NextResponse.json(
        { error: patch.error },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    const { data, error } = await auth.supabase
      .from("institutional_feedback")
      .update({ ...patch.value, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: clientSafeError("Unable to update feedback", error) },
        { status: 500, headers: requestIdHeaders(requestId) },
      );
    }

    return NextResponse.json(
      { ok: true, feedback: data },
      {
        headers: {
          "Cache-Control": "no-store",
          ...requestIdHeaders(requestId),
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Unable to update feedback",
          err instanceof Error ? err : null,
        ),
      },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

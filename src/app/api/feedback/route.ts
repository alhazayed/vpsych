import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  appendFeedbackAudit,
  validateFeedbackInput,
} from "@/lib/enterprise/feedback";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";

export const dynamic = "force-dynamic";

/**
 * POST /api/feedback — authenticated institutional feedback submit (CIDP).
 * GET /api/feedback — list the caller's own submissions.
 */
export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `feedback-submit:${auth.user.id}`,
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

  try {
    const body = await request.json();
    const validated = validateFeedbackInput(body);
    if (!validated.ok) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    const row = {
      ...validated.value,
      submitter_id: auth.user.id,
      assigned_owner_id: null,
      resolution: "",
      audit_trail: appendFeedbackAudit([], {
        actor_user_id: auth.user.id,
        action: "submit",
        to: {
          severity: validated.value.severity,
          status: "submitted",
          category: validated.value.category,
        },
      }),
    };

    const { data, error } = await auth.supabase
      .from("institutional_feedback")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { error: clientSafeError("Unable to submit feedback", error) },
        { status: 500, headers: requestIdHeaders(requestId) },
      );
    }

    return NextResponse.json(
      { ok: true, feedback: data },
      {
        status: 201,
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
          "Unable to submit feedback",
          err instanceof Error ? err : null,
        ),
      },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

export async function GET(request: Request) {
  const requestId = resolveRequestId(request);
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `feedback-list:${auth.user.id}`,
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

  const { data, error } = await auth.supabase
    .from("institutional_feedback")
    .select("*")
    .eq("submitter_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Unable to list feedback", error) },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }

  return NextResponse.json(
    { items: data ?? [] },
    {
      headers: {
        "Cache-Control": "no-store",
        ...requestIdHeaders(requestId),
      },
    },
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import {
  submitFeedback,
  validateFeedbackInput,
  type FeedbackSubmitInput,
} from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Authenticated institutional feedback submit.
 * Independent of patient cognition — never writes clinical state.
 */
export async function POST(request: Request) {
  const requestId = resolveRequestId(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: requestIdHeaders(requestId) },
    );
  }

  const limited = await rateLimit(`feedback:${user.id}`, 30, 60 * 60 * 1000);
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

  let body: FeedbackSubmitInput;
  try {
    body = (await request.json()) as FeedbackSubmitInput;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  const err = validateFeedbackInput(body);
  if (err) {
    return NextResponse.json(
      { error: err },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  const row = submitFeedback(body, user.id);

  // Best-effort durable persist — soft-fail; memory remains SSOT for process.
  const { error: dbError } = await supabase.from("institutional_feedback").insert({
    id: row.id,
    created_at: row.created_at,
    submitter_id: row.submitter_id,
    institution_id: row.institution_id,
    role_persona: row.role_persona,
    category: row.category,
    severity: row.severity,
    rating: row.rating,
    body: row.body,
    session_id: row.session_id,
    locale: row.locale,
    metadata: row.metadata,
  });
  if (dbError) {
    console.warn("[feedback] persist soft-fail", dbError.message);
  }

  return NextResponse.json(
    {
      ok: true,
      feedback: row,
      persisted: !dbError,
      ownership:
        "Institutional feedback only — patient cognition unchanged",
    },
    { headers: requestIdHeaders(requestId) },
  );
}

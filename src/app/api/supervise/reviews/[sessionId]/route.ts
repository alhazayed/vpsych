import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { requireApiSupervisor } from "@/lib/skill-tests/access";
import { isUuid } from "@/lib/skill-tests";
import { validateReviewInput } from "@/lib/supervisor-reviews";
import { traineeMayReadComment } from "@/lib/supervisor-reviews/trainee-comments";

type Params = { params: Promise<{ sessionId: string }> };

const REVIEW_COLUMNS =
  "id, session_id, reviewer_id, comment, adjusted_overall, flagged, created_at, updated_at";

async function limit(userId: string) {
  const limited = await rateLimit(`review:${userId}`, 60, 60 * 60 * 1000);
  if (limited.ok) return null;
  return NextResponse.json(
    { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
    { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
  );
}

const forbidden = () =>
  NextResponse.json(
    { error: "You cannot review this report", code: "review_forbidden" },
    { status: 403 },
  );

/**
 * Saves the caller's review of one report: comment, flag and adjusted overall
 * score. The AI report is never written here. RLS decides who may review: an
 * admin, the supervisor who assigned the skill test, or a supervisor linked to
 * the trainee (practice sessions), and only once the report exists.
 */
export async function PUT(request: Request, { params }: Params) {
  const { sessionId } = await params;
  const auth = await requireApiSupervisor(request, {
    action: "supervisor.review.save",
    resourceId: sessionId,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await limit(user.id);
  if (limited) return limited;
  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Report not found", code: "review_not_found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = validateReviewInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid review", code: parsed.error },
      { status: 400 },
    );
  }
  const { comment, adjustedOverall, flagged } = parsed.value;

  // Whether the trainee may read this comment is decided here, on the
  // server, because a sealed ladder case can only be opened here. A session
  // the caller cannot read gets no review either (RLS refuses the upsert).
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("id, skill_test_assignment_id, sealed_case, clinical_snapshot")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) {
    console.error("[supervise/reviews] session load failed", {
      sessionId,
      code: sessionError.code,
      error: sessionError.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not save the review", sessionError) },
      { status: 500 },
    );
  }
  if (!sessionRow) return forbidden();
  const traineeVisible = traineeMayReadComment(sessionRow, comment, adjustedOverall);

  const { data, error } = await supabase
    .from("session_report_reviews")
    .upsert(
      {
        session_id: sessionId,
        reviewer_id: user.id,
        comment,
        adjusted_overall: adjustedOverall,
        flagged,
        trainee_visible: traineeVisible,
      },
      { onConflict: "session_id,reviewer_id" },
    )
    .select(REVIEW_COLUMNS)
    .maybeSingle();

  if (error) {
    // 42501: RLS refused (no access, or no report yet).
    if (error.code === "42501") {
      await logSecurityEvent({
        action: "supervisor.review.save",
        outcome: "denied",
        resourceType: "session_report",
        resourceId: sessionId,
        request,
      });
      return forbidden();
    }
    console.error("[supervise/reviews] save failed", {
      sessionId,
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not save the review", error) },
      { status: 500 },
    );
  }
  // RLS can also filter the returned row away; only a row read back is saved.
  if (!data) return forbidden();

  await logSecurityEvent({
    action: "supervisor.review.save",
    outcome: "success",
    resourceType: "session_report",
    resourceId: sessionId,
    metadata: { adjusted: adjustedOverall !== null, flagged },
    request,
  });
  return NextResponse.json({ ok: true, review: data });
}

/** Removes the caller's own review of one report. */
export async function DELETE(request: Request, { params }: Params) {
  const { sessionId } = await params;
  const auth = await requireApiSupervisor(request, {
    action: "supervisor.review.delete",
    resourceId: sessionId,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await limit(user.id);
  if (limited) return limited;
  if (!isUuid(sessionId)) {
    return NextResponse.json({ error: "Review not found", code: "review_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("session_report_reviews")
    .delete()
    .eq("session_id", sessionId)
    .eq("reviewer_id", user.id)
    .select("id");
  if (error) {
    console.error("[supervise/reviews] delete failed", {
      sessionId,
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not remove the review", error) },
      { status: 500 },
    );
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Review not found", code: "review_not_found" }, { status: 404 });
  }

  await logSecurityEvent({
    action: "supervisor.review.delete",
    outcome: "success",
    resourceType: "session_report",
    resourceId: sessionId,
    request,
  });
  return NextResponse.json({ ok: true });
}

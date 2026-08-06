import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — submit educational outcome measure (baseline/post/followup). */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-outcome:${auth.user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    enrollmentId?: string;
    studyId?: string;
    timepoint?: string;
    instrumentSlug?: string;
    scores?: Record<string, unknown>;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const timepoint = body.timepoint;
  if (
    !body.enrollmentId ||
    !body.studyId ||
    !body.instrumentSlug ||
    !body.scores ||
    !["baseline", "post", "followup"].includes(timepoint ?? "")
  ) {
    return NextResponse.json(
      {
        error:
          "enrollmentId, studyId, timepoint (baseline|post|followup), instrumentSlug, scores required",
      },
      { status: 400 },
    );
  }

  const { data: enrollment } = await auth.supabase
    .from("cvp_enrollments")
    .select("id, profile_id")
    .eq("id", body.enrollmentId)
    .eq("study_id", body.studyId)
    .maybeSingle();

  if (
    !enrollment ||
    (enrollment.profile_id !== auth.user.id && auth.profile.role !== "admin")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("cvp_outcome_measures")
    .insert({
      study_id: body.studyId,
      enrollment_id: body.enrollmentId,
      timepoint,
      instrument_slug: body.instrumentSlug.trim().slice(0, 80),
      scores: body.scores,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not save outcome measure", error) },
      { status: 500 },
    );
  }

  if (timepoint === "baseline") {
    await auth.supabase
      .from("cvp_enrollments")
      .update({ baseline_completed_at: new Date().toISOString() })
      .eq("id", body.enrollmentId);
  }

  return NextResponse.json({ ok: true, id: data.id });
}

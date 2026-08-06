import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** POST — submit a dual/multi-rater score for IRA. */
export async function POST(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-dual:${auth.user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    studyId?: string;
    sessionId?: string;
    scores?: Record<string, unknown>;
    instrument?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.studyId || !body.sessionId || !body.scores) {
    return NextResponse.json(
      { error: "studyId, sessionId, and scores are required" },
      { status: 400 },
    );
  }

  const { data: enrollment } = await auth.supabase
    .from("cvp_enrollments")
    .select("id")
    .eq("study_id", body.studyId)
    .eq("profile_id", auth.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!enrollment && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Not enrolled in study" }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("cvp_dual_ratings")
    .upsert(
      {
        study_id: body.studyId,
        session_id: body.sessionId,
        rater_id: auth.user.id,
        instrument: body.instrument || "ppp_likert_v1",
        scores: body.scores,
      },
      { onConflict: "study_id,session_id,rater_id,instrument" },
    )
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not save dual rating", error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, id: data.id });
}

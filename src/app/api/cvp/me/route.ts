import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET — reviewer dashboard: enrollments, assignments, progress. */
export async function GET(request: Request) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(`cvp-me:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: enrollments, error } = await auth.supabase
    .from("cvp_enrollments")
    .select(
      "id, study_id, institution_id, role_in_study, consent_version, baseline_completed_at, is_active, created_at, cvp_studies(id, slug, title, status, protocol_version)",
    )
    .eq("profile_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({
      enrollments: [],
      assignments: [],
      warning: error.message.includes("does not exist")
        ? "CVP migration not applied"
        : error.message,
    });
  }

  const enrIds = (enrollments ?? []).map((e) => e.id);
  let assignments: unknown[] = [];
  if (enrIds.length > 0) {
    const { data } = await auth.supabase
      .from("cvp_assignments")
      .select(
        "id, study_id, enrollment_id, avatar_id, allocation_arm, sequence_index, status, session_id, due_at, assigned_at, completed_at, avatars(id, name, disorder, portrait_url)",
      )
      .in("enrollment_id", enrIds)
      .order("sequence_index");
    assignments = data ?? [];
  }

  const { data: snapshots } = await auth.supabase
    .from("cvp_reviewer_snapshots")
    .select("id, enrollment_id, captured_at, sessions_completed, metrics")
    .in("enrollment_id", enrIds.length ? enrIds : ["00000000-0000-0000-0000-000000000000"])
    .order("captured_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    enrollments: enrollments ?? [],
    assignments,
    snapshots: snapshots ?? [],
  });
}

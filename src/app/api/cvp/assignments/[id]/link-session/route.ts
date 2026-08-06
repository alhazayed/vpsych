import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — link a completed session to a CVP assignment (reviewer-owned).
 * Does not alter how the session was simulated.
 */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;

  const { id: assignmentId } = await ctx.params;
  const limited = await rateLimit(`cvp-link:${auth.user.id}`, 40, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const { data: assignment } = await auth.supabase
    .from("cvp_assignments")
    .select("id, enrollment_id, avatar_id, status, cvp_enrollments(profile_id)")
    .eq("id", assignmentId)
    .maybeSingle();

  const enr = assignment?.cvp_enrollments as
    | { profile_id: string }
    | { profile_id: string }[]
    | null;
  const profileId = Array.isArray(enr) ? enr[0]?.profile_id : enr?.profile_id;

  if (
    !assignment ||
    (profileId !== auth.user.id && auth.profile.role !== "admin")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: session } = await auth.supabase
    .from("sessions")
    .select("id, therapist_id, avatar_id, status")
    .eq("id", body.sessionId)
    .maybeSingle();

  if (!session || session.therapist_id !== auth.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.avatar_id !== assignment.avatar_id) {
    return NextResponse.json(
      { error: "Session avatar does not match assignment" },
      { status: 400 },
    );
  }

  const completed =
    session.status === "completed" || session.status === "expired";

  const { data, error } = await auth.supabase
    .from("cvp_assignments")
    .update({
      session_id: session.id,
      status: completed ? "completed" : "active",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", assignmentId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not link session", error) },
      { status: 500 },
    );
  }

  // Longitudinal snapshot best-effort
  if (completed) {
    const { count } = await auth.supabase
      .from("cvp_assignments")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", assignment.enrollment_id)
      .eq("status", "completed");
    await auth.supabase.from("cvp_reviewer_snapshots").insert({
      enrollment_id: assignment.enrollment_id,
      sessions_completed: count ?? 1,
      metrics: { last_assignment_id: assignmentId, last_session_id: session.id },
    });
  }

  return NextResponse.json({ ok: true, assignment: data });
}

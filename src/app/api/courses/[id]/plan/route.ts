import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  canWritePlan,
  countCourseSessions,
  loadCourseById,
  minPlannedSessions,
  validateTreatmentPlan,
} from "@/lib/therapy-course";

type Params = { params: Promise<{ id: string }> };

/** Submit or revise the treatment plan for a therapy course. */
export async function PUT(request: Request, { params }: Params) {
  const { id: courseId } = await params;
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`course:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const course = await loadCourseById(supabase, courseId);
  if (!course || course.therapist_id !== user.id) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.status !== "active") {
    return NextResponse.json(
      { error: "This therapy course has ended.", code: "course_completed" },
      { status: 409 },
    );
  }

  const counts = await countCourseSessions(supabase, course.id);
  if (!counts) {
    return NextResponse.json(
      { error: "Could not load course sessions" },
      { status: 500 },
    );
  }
  if (!canWritePlan(course, counts.completed)) {
    return NextResponse.json(
      {
        error: "The treatment plan is written after the second session.",
        code: "plan_too_early",
      },
      { status: 409 },
    );
  }

  const minSessions = minPlannedSessions(counts.total);
  const result = validateTreatmentPlan(body, { minSessions });
  if (!result.ok) {
    return NextResponse.json(
      { error: "Invalid treatment plan", field: result.field, minSessions },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("therapy_courses")
    .update({
      treatment_plan: result.plan,
      planned_sessions: result.plan.expected_sessions,
      plan_submitted_at: course.plan_submitted_at ?? now,
      plan_updated_at: now,
      updated_at: now,
    })
    .eq("id", course.id)
    .eq("therapist_id", user.id)
    .eq("status", "active")
    .select("id, planned_sessions, plan_submitted_at, plan_updated_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: clientSafeError("Could not save the treatment plan", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    courseId: data.id,
    plannedSessions: data.planned_sessions,
    planSubmittedAt: data.plan_submitted_at,
    planUpdatedAt: data.plan_updated_at,
    revised: Boolean(course.treatment_plan),
  });
}

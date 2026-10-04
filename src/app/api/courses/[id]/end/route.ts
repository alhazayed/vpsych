import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { completeCourse, loadCourseById } from "@/lib/therapy-course";

type Params = { params: Promise<{ id: string }> };

/** Trainee ends (terminates) a therapy course. Idempotent. */
export async function POST(request: Request, { params }: Params) {
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

  const course = await loadCourseById(supabase, courseId);
  if (!course || course.therapist_id !== user.id) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  if (course.status !== "active") {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  const changed = await completeCourse(supabase, course.id, "terminated");
  if (!changed) {
    const fresh = await loadCourseById(supabase, course.id);
    if (fresh?.status === "completed") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }
    return NextResponse.json(
      { error: "Could not end the therapy course" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

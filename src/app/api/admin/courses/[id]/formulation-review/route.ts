import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildCaseFormulationKey, loadCourseById } from "@/lib/therapy-course";
import { reviewFormulation } from "@/lib/therapy-course/formulation-review";

type Params = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/courses/[id]/formulation-review — rate the trainee's 5 Ps
 * against the case's own 5 Ps. Admin-only, on demand, persists nothing.
 */
export async function POST(request: Request, { params }: Params) {
  const { id: courseId } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.course.formulation_review",
    resourceType: "therapy_course",
    resourceId: courseId,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-formulation-review:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!UUID_RE.test(courseId)) {
    return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is fine: English notes.
  }
  const language =
    (body as { language?: unknown } | null)?.language === "ar" ? "ar" : "en";

  const course = await loadCourseById(supabase, courseId);
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  const fivePs = course.treatment_plan?.five_ps ?? null;
  if (!fivePs) {
    return NextResponse.json(
      { error: "This treatment plan has no 5 Ps formulation.", code: "no_five_ps" },
      { status: 409 },
    );
  }

  const result = await reviewFormulation({
    trainee: fivePs,
    key: buildCaseFormulationKey(course.clinical_snapshot),
    language,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.code === "AI_UNAVAILABLE"
            ? "The AI examiner is unavailable right now. Try again later."
            : "The AI examiner returned an unusable answer. Try again.",
        code: result.code,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, review: result.review });
}

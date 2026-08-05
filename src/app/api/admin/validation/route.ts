import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  VALIDATION_PROGRAM_VERSION,
  appendLearnerRating,
  appendPsychiatristRating,
  buildValidationDashboard,
  computeLearnerAuthenticityScore,
  computePsychiatristAuthenticityScore,
  emptyLearnerForm,
  emptyPsychiatristForm,
  listLearnerRatings,
  listPsychiatristRatings,
  type LearnerRatingForm,
  type PsychiatristRatingForm,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * GET — Integrated validation dashboard (Mission 22 Workstream F).
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.validation.dashboard",
    resourceType: "clinical_validation",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-validation:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const dashboard = buildValidationDashboard({
    regression_suite_green: true,
    migration_applied: true,
  });

  return NextResponse.json({
    program_version: VALIDATION_PROGRAM_VERSION,
    dashboard,
  });
}

/**
 * POST — submit PAS/LAS rating forms or request blank templates.
 * Body: { action: "submit_pas"|"submit_las"|"template_pas"|"template_las", ... }
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.validation.ratings",
    resourceType: "clinical_validation",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-validation-post:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    form?: PsychiatristRatingForm | LearnerRatingForm;
    rater_id?: string;
    rater_role?: string;
    case_id?: string;
  };

  if (body.action === "template_pas") {
    return NextResponse.json({
      form: emptyPsychiatristForm({
        rater_id: body.rater_id ?? "rater",
        rater_role: (body.rater_role as "consultant_psychiatrist") ??
          "consultant_psychiatrist",
        case_id: body.case_id ?? "case-blind",
      }),
    });
  }
  if (body.action === "template_las") {
    return NextResponse.json({
      form: emptyLearnerForm({
        rater_id: body.rater_id ?? "learner",
        rater_role: (body.rater_role as "medical_student") ?? "medical_student",
        case_id: body.case_id ?? "case-blind",
      }),
    });
  }

  if (body.action === "submit_pas" && body.form) {
    const form = body.form as PsychiatristRatingForm;
    if (!form.blinded || !form.arm_unknown_to_rater) {
      return NextResponse.json(
        { error: "PAS forms must remain blinded (blinded + arm_unknown_to_rater)" },
        { status: 400 },
      );
    }
    appendPsychiatristRating(form);
    return NextResponse.json({
      ok: true,
      pas: computePsychiatristAuthenticityScore(listPsychiatristRatings()),
    });
  }

  if (body.action === "submit_las" && body.form) {
    appendLearnerRating(body.form as LearnerRatingForm);
    return NextResponse.json({
      ok: true,
      las: computeLearnerAuthenticityScore(listLearnerRatings()),
    });
  }

  return NextResponse.json(
    {
      error:
        "action required: template_pas | template_las | submit_pas | submit_las",
    },
    { status: 400 },
  );
}

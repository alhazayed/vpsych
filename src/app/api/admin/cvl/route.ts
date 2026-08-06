import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildCvlDashboard,
  createStudyWithAssignments,
  cvlGetAssignment,
  cvlGetStudy,
  cvlListAssignments,
  cvlListBpc,
  cvlListEducation,
  cvlListHcf,
  cvlListLongitudinal,
  deriveClinicalFidelityLevel,
  loadCvlCorpus,
  persistAssessmentAccuracy,
  persistBpc,
  persistBtc,
  persistCfl,
  persistEducation,
  persistHcf,
  persistLongitudinal,
  persistStudyBundle,
  persistStudyStatus,
  revealArm,
  sealCflToQualityLedgerAsync,
  toBlindedAssignmentView,
  validateAssessmentAccuracy,
  validateBpcSubmission,
  validateBtcSubmission,
  validateCreateStudy,
  validateEducationOutcome,
  validateHcfEvaluation,
  validateLongitudinalMeasure,
  computeAllMetrics,
} from "@/lib/cvl";

export const dynamic = "force-dynamic";

/** GET — CVL executive dashboard */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvl.dashboard",
    resourceType: "cvl",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-cvl:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { corpus, source } = await loadCvlCorpus(auth.supabase);
  const dashboard = buildCvlDashboard({
    studies: corpus.studies,
    assignments: corpus.assignments,
    bpc: corpus.bpc,
    hcf: corpus.hcf,
    education: corpus.education,
    longitudinal: corpus.longitudinal,
    cfl: corpus.cfl,
  });

  return NextResponse.json({
    source,
    is_fabricated: false,
    dashboard,
  });
}

type ActionBody = {
  action?: string;
  study?: unknown;
  cases?: Array<{ case_ref: string; disorder_slug: string; modality?: string }>;
  study_id?: string;
  status?: string;
  assignment_id?: string;
  form?: unknown;
  blinded?: boolean;
  arm_unknown_to_rater?: boolean;
  case_ref?: string;
  disorder_slug?: string;
  human_approved?: boolean;
};

/** POST — study ops, blinded ratings, CFL compute */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvl.mutate",
    resourceType: "cvl",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-cvl-post:${auth.user.id}`,
    120,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as ActionBody | null;
  if (!body?.action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  // Hydrate memory from DB so assignment lookups work across instances.
  await loadCvlCorpus(auth.supabase);

  switch (body.action) {
    case "create_study": {
      const v = validateCreateStudy(body.study ?? body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      const cases = body.cases?.length
        ? body.cases
        : [{ case_ref: "pending-case", disorder_slug: "mdd-recurrent-moderate" }];
      const created = createStudyWithAssignments({
        draft: v.draft,
        cases,
        reviewers_per_case: 2,
      });
      const source = await persistStudyBundle(
        auth.supabase,
        created.study,
        created.assignments,
        auth.user.id,
      );
      return NextResponse.json({
        ok: true,
        source,
        study: created.study,
        assignments: created.assignments.map(toBlindedAssignmentView),
        note: "Arms allocated but hidden from reviewer views.",
        is_fabricated: false,
      });
    }

    case "set_status": {
      if (!body.study_id || !body.status) {
        return NextResponse.json(
          { error: "study_id and status required" },
          { status: 400 },
        );
      }
      const updated = await persistStudyStatus(
        auth.supabase,
        body.study_id,
        body.status as Parameters<typeof persistStudyStatus>[2],
      );
      if (!updated) {
        return NextResponse.json({ error: "Study not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, study: updated });
    }

    case "get_blinded_assignment": {
      if (!body.assignment_id) {
        return NextResponse.json(
          { error: "assignment_id required" },
          { status: 400 },
        );
      }
      const a = cvlGetAssignment(body.assignment_id);
      if (!a) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ assignment: toBlindedAssignmentView(a) });
    }

    case "reveal_arm": {
      if (!body.assignment_id) {
        return NextResponse.json(
          { error: "assignment_id required" },
          { status: 400 },
        );
      }
      const a = cvlGetAssignment(body.assignment_id);
      const study = a ? cvlGetStudy(a.study_id) : null;
      if (!a || !study) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const revealed = revealArm(a, study.status);
      if ("error" in revealed) {
        return NextResponse.json({ error: revealed.error }, { status: 403 });
      }
      return NextResponse.json({ arm: revealed.arm, study_status: study.status });
    }

    case "submit_bpc": {
      const v = validateBpcSubmission({
        ...(body.form && typeof body.form === "object" ? body.form : body),
        blinded: body.blinded ?? true,
        arm_unknown_to_rater: body.arm_unknown_to_rater ?? true,
      });
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      const a = cvlGetAssignment(v.submission.assignment_id);
      if (!a || a.study_id !== v.submission.study_id) {
        return NextResponse.json(
          { error: "assignment/study mismatch" },
          { status: 400 },
        );
      }
      const source = await persistBpc(auth.supabase, v.submission);
      return NextResponse.json({
        ok: true,
        stored: true,
        source,
        is_fabricated: false,
      });
    }

    case "submit_btc": {
      const v = validateBtcSubmission({
        ...(body.form && typeof body.form === "object" ? body.form : body),
        blinded: body.blinded ?? true,
        arm_unknown_to_rater: body.arm_unknown_to_rater ?? true,
      });
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      const source = await persistBtc(auth.supabase, v.submission);
      return NextResponse.json({ ok: true, stored: true, source, is_fabricated: false });
    }

    case "submit_hcf": {
      const v = validateHcfEvaluation(body.form ?? body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      const source = await persistHcf(auth.supabase, v.row);
      return NextResponse.json({ ok: true, stored: true, source, is_fabricated: false });
    }

    case "submit_education": {
      const v = validateEducationOutcome(body.form ?? body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      const source = await persistEducation(auth.supabase, v.row);
      return NextResponse.json({ ok: true, stored: true, source, is_fabricated: false });
    }

    case "submit_longitudinal": {
      const v = validateLongitudinalMeasure(body.form ?? body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      const source = await persistLongitudinal(auth.supabase, v.row);
      return NextResponse.json({ ok: true, stored: true, source, is_fabricated: false });
    }

    case "submit_assessment_accuracy": {
      const v = validateAssessmentAccuracy(body.form ?? body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      const source = await persistAssessmentAccuracy(auth.supabase, v.row);
      return NextResponse.json({
        ok: true,
        stored: true,
        source,
        absolute_error: v.row.absolute_error,
        correlation: v.row.correlation,
        is_fabricated: false,
      });
    }

    case "compute_cfl": {
      if (!body.case_ref) {
        return NextResponse.json({ error: "case_ref required" }, { status: 400 });
      }
      const metrics = computeAllMetrics({
        bpc: cvlListBpc(),
        assignments: cvlListAssignments(),
        hcf: cvlListHcf(),
        education: cvlListEducation(),
        longitudinal: cvlListLongitudinal(),
      });
      const cfl = deriveClinicalFidelityLevel({
        case_ref: body.case_ref,
        disorder_slug: body.disorder_slug,
        metrics,
        has_blind_transcript_pass: cvlListBpc().some(
          (r) => r.modality === "transcript",
        ),
        has_blind_live_pass: cvlListBpc().some(
          (r) => r.modality === "live_session",
        ),
        sp_noninferior: null,
      });
      if (body.human_approved) cfl.human_approved = true;
      const seal = await sealCflToQualityLedgerAsync(auth.supabase, cfl);
      cfl.ledger_ref = seal.ledger_ref;
      const { record, source } = await persistCfl(auth.supabase, cfl);
      return NextResponse.json({
        ok: true,
        cfl: record,
        ledger: seal,
        source,
        is_fabricated: false,
      });
    }

    case "list_btc":
      return NextResponse.json({
        ratings: (await loadCvlCorpus(auth.supabase)).corpus.btc.filter((r) =>
          body.study_id ? r.study_id === body.study_id : true,
        ),
      });

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

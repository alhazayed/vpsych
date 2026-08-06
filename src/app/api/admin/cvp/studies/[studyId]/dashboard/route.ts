import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { buildCvpDashboard, type DashboardInput } from "@/lib/cvp";
import type { CvpStudy, InstitutionComparisonRow } from "@/lib/cvp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ studyId: string }> };

/** GET — Clinical Validation Dashboard for a study. */
export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.dashboard",
    resourceType: "cvp_dashboard",
  });
  if (!auth.ok) return auth.response;

  const { studyId } = await ctx.params;
  const limited = await rateLimit(`cvp-dash:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const sb = auth.supabase;

  const [
    studyRes,
    enrollRes,
    inviteRes,
    assignRes,
    blindRes,
    dualRes,
    outcomeRes,
    snapRes,
    calRes,
    exportRes,
    siteRes,
  ] = await Promise.all([
    sb.from("cvp_studies").select("*").eq("id", studyId).maybeSingle(),
    sb
      .from("cvp_enrollments")
      .select("is_active, institution_id, id, profile_id")
      .eq("study_id", studyId),
    sb.from("cvp_invitations").select("status").eq("study_id", studyId),
    sb
      .from("cvp_assignments")
      .select("status, allocation_arm, enrollment_id")
      .eq("study_id", studyId),
    sb
      .from("cvp_blind_challenges")
      .select("overall_realism, would_use_in_training")
      .eq("study_id", studyId),
    sb
      .from("cvp_dual_ratings")
      .select("session_id, rater_id, scores")
      .eq("study_id", studyId),
    sb
      .from("cvp_outcome_measures")
      .select("enrollment_id, timepoint, instrument_slug, scores")
      .eq("study_id", studyId),
    sb.from("cvp_reviewer_snapshots").select("enrollment_id"),
    sb
      .from("cvp_calibration_items")
      .select("expert_scores")
      .eq("study_id", studyId),
    sb.from("cvp_export_jobs").select("status").eq("study_id", studyId),
    sb
      .from("cvp_study_institutions")
      .select("institution_id, site_code, institutions(id, name)")
      .eq("study_id", studyId),
  ]);

  if (studyRes.error?.message?.includes("does not exist")) {
    return NextResponse.json({
      dashboard: buildCvpDashboard(emptyInput()),
      source: "unavailable",
      warning:
        "CVP tables not applied. Run migration 20260806100000_clinical_validation_program.",
    });
  }

  const dualScores: Record<string, Record<string, number>> = {};
  for (const row of dualRes.data ?? []) {
    const sid = String((row as { session_id: string }).session_id);
    const rid = String((row as { rater_id: string }).rater_id);
    const scores = (row as { scores: Record<string, unknown> }).scores ?? {};
    const overall =
      typeof scores.overall === "number"
        ? scores.overall
        : typeof scores.clinical_realism === "number"
          ? scores.clinical_realism
          : null;
    if (overall == null) continue;
    dualScores[sid] ??= {};
    dualScores[sid]![rid] = overall;
  }

  // Institution comparison
  const enrollments = enrollRes.data ?? [];
  const assignments = assignRes.data ?? [];
  const institutions: InstitutionComparisonRow[] = (siteRes.data ?? []).map(
    (site) => {
      const inst = site.institutions as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null;
      const institution =
        Array.isArray(inst) ? inst[0] : inst;
      const institutionId = String(
        site.institution_id ?? institution?.id ?? "unknown",
      );
      const siteEnrollments = enrollments.filter(
        (e) => e.institution_id === institutionId,
      );
      const enrIds = new Set(siteEnrollments.map((e) => e.id));
      const completed = assignments.filter(
        (a) =>
          enrIds.has(a.enrollment_id) && a.status === "completed",
      ).length;
      return {
        institution_id: institutionId,
        institution_name: institution?.name ?? institutionId,
        site_code: site.site_code as string,
        enrollments: siteEnrollments.length,
        completed_assignments: completed,
        avg_realism: null,
        avg_educational_value: null,
        blind_scores: 0,
      };
    },
  );

  // Longitudinal snapshots filtered to study enrollments
  const studyEnrIds = new Set(enrollments.map((e) => e.id));
  const snapshots = (snapRes.data ?? []).filter((s) =>
    studyEnrIds.has(s.enrollment_id),
  );

  const input: DashboardInput = {
    study: (studyRes.data as CvpStudy | null) ?? null,
    enrollments: enrollments.map((e) => ({
      is_active: Boolean(e.is_active),
      institution_id: e.institution_id as string | null,
    })),
    invitations: (inviteRes.data ?? []) as { status: string }[],
    assignments: assignments as DashboardInput["assignments"],
    blind: (blindRes.data ?? []) as DashboardInput["blind"],
    dualScores,
    outcomes: (outcomeRes.data ?? []) as DashboardInput["outcomes"],
    snapshots,
    calibration: (calRes.data ?? []) as DashboardInput["calibration"],
    exports: (exportRes.data ?? []) as { status: string }[],
    institutions,
  };

  return NextResponse.json({
    dashboard: buildCvpDashboard(input),
    source: "database",
  });
}

function emptyInput(): DashboardInput {
  return {
    study: null,
    enrollments: [],
    invitations: [],
    assignments: [],
    blind: [],
    dualScores: {},
    institutions: [],
    outcomes: [],
    snapshots: [],
    calibration: [],
    exports: [],
  };
}

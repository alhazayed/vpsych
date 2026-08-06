import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { buildPublicationPackage, type DashboardInput } from "@/lib/cvp";
import type { CvpStudy, DeidentifyLevel, ExportKind } from "@/lib/cvp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ studyId: string }> };

const KINDS: ExportKind[] = [
  "ratings_csv",
  "consort_summary",
  "publication_package",
  "institution_comparison",
  "reliability_report",
  "deidentified_full",
];

/** POST — generate a publication-ready / de-identified export artifact. */
export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cvp.export",
    resourceType: "cvp_export_jobs",
  });
  if (!auth.ok) return auth.response;

  const { studyId } = await ctx.params;
  const limited = await rateLimit(`cvp-export:${auth.user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { kind?: string; deidentifyLevel?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = (KINDS as string[]).includes(body.kind ?? "")
    ? (body.kind as ExportKind)
    : "publication_package";
  const deidentifyLevel = (
    ["none", "standard", "strict"] as DeidentifyLevel[]
  ).includes(body.deidentifyLevel as DeidentifyLevel)
    ? (body.deidentifyLevel as DeidentifyLevel)
    : "standard";

  const { data: job, error: jobErr } = await auth.supabase
    .from("cvp_export_jobs")
    .insert({
      study_id: studyId,
      requested_by: auth.user.id,
      export_kind: kind,
      deidentify_level: deidentifyLevel,
      status: "running",
    })
    .select("id")
    .single();

  if (jobErr) {
    return NextResponse.json(
      { error: clientSafeError("Could not start export", jobErr) },
      { status: 500 },
    );
  }

  const { data: study } = await auth.supabase
    .from("cvp_studies")
    .select("*")
    .eq("id", studyId)
    .maybeSingle();

  // Pull PPP ratings joined via sessions owned by enrolled reviewers (best-effort)
  const { data: enrollments } = await auth.supabase
    .from("cvp_enrollments")
    .select("profile_id, institution_id")
    .eq("study_id", studyId);

  const profileIds = (enrollments ?? []).map((e) => e.profile_id);
  let ratingRows: Parameters<
    typeof buildPublicationPackage
  >[0]["ratingRows"] = [];

  if (profileIds.length > 0) {
    const { data: ratings } = await auth.supabase
      .from("ppp_session_ratings")
      .select("*")
      .in("reviewer_id", profileIds)
      .limit(5000);
    ratingRows = (ratings ?? []).map((r) => ({
      study_id: studyId,
      session_id: r.session_id as string,
      reviewer_id: r.reviewer_id as string,
      institution_id:
        enrollments?.find((e) => e.profile_id === r.reviewer_id)
          ?.institution_id ?? null,
      clinical_realism: r.clinical_realism as number,
      educational_value: r.educational_value as number,
      conversation_naturalness: r.conversation_naturalness as number,
      therapeutic_alliance: r.therapeutic_alliance as number,
      patient_believability: r.patient_believability as number,
      learning_impact: r.learning_impact as number,
      voice_realism: r.voice_realism as number | null,
      arabic_quality: r.arabic_quality as number | null,
      english_quality: r.english_quality as number | null,
      free_text: r.free_text as string | null,
      created_at: r.created_at as string,
    }));
  }

  const emptyDash: DashboardInput = {
    study: (study as CvpStudy | null) ?? null,
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

  const artifact = buildPublicationPackage({
    kind,
    deidentifyLevel,
    studySlug: (study as { slug?: string } | null)?.slug ?? null,
    ratingRows,
    dashboardInput: emptyDash,
  });

  await auth.supabase
    .from("cvp_export_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      artifact: {
        kind: artifact.kind,
        generated_at: artifact.generated_at,
        deidentify_level: artifact.deidentify_level,
        rating_count: artifact.ratings.length,
        ratings_csv: artifact.ratings_csv,
        codebook: artifact.codebook,
        ethics_notes: artifact.ethics_notes,
        reliability: artifact.dashboard_summary.reliability,
        consort: artifact.dashboard_summary.consort,
      },
    })
    .eq("id", job.id);

  return NextResponse.json({
    ok: true,
    exportId: job.id,
    artifact: {
      ...artifact,
      // Keep response bounded
      ratings: artifact.ratings.slice(0, 50),
    },
  });
}

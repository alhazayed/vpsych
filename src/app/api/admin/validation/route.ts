import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildExpertRatingOfflineCorpus,
  buildPublicationSupport,
  buildResearchDatasetPackage,
  buildValidationDashboard,
  buildValidationOfflineCorpus,
  exportRunsCsv,
  listExpertRatings,
  listValidationRuns,
  runValidationPipeline,
  simulateLongitudinalCorpus,
  storeExpertRating,
  VALIDATION_VERSION,
  type ExpertRating,
  type ExpertRatingDomain,
} from "@/lib/validation";
import { stableId } from "@/lib/validation/helpers";

export const dynamic = "force-dynamic";

/**
 * Stage 8 research dashboard + compute/export.
 * Admin-only. Observational — never modifies patient state.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.validation.dashboard",
    resourceType: "validation_runs",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-validation:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "dashboard").toLowerCase();

  let runs = listValidationRuns(5000);
  let ratings = listExpertRatings(5000);
  let source: "memory" | "offline_corpus" = "memory";
  if (!runs.length) {
    runs = buildValidationOfflineCorpus();
    source = "offline_corpus";
  }
  if (!ratings.length) {
    ratings = buildExpertRatingOfflineCorpus();
  }

  if (format === "csv") {
    return new NextResponse(exportRunsCsv(runs), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition":
          'attachment; filename="vpsych-validation-export.csv"',
        "X-Export-Source": source,
      },
    });
  }

  if (format === "package" || format === "json" || format === "fhir") {
    const pkg = buildResearchDatasetPackage({
      runs,
      ratings,
      format: format === "fhir" ? "fhir" : format === "json" ? "json" : "package",
    });
    return NextResponse.json({
      meta: {
        exported_at: pkg.exported_at,
        source,
        n: runs.length,
        validation_version: VALIDATION_VERSION,
        anonymized: true,
      },
      package: pkg,
    });
  }

  if (format === "publication") {
    return NextResponse.json({
      meta: { source, validation_version: VALIDATION_VERSION },
      publication: buildPublicationSupport({
        runs,
        dashboard: buildValidationDashboard(runs, ratings),
      }),
    });
  }

  const dashboard = buildValidationDashboard(runs, ratings);
  return NextResponse.json({
    meta: {
      source,
      validation_version: VALIDATION_VERSION,
      observational: true,
      patient_state_modified: false,
    },
    dashboard,
    recent_runs: runs.slice(0, 25).map((r) => ({
      id: r.id,
      session_id: r.session_id,
      realism: r.realism.overall,
      consistency: r.consistency.overall,
      created_at: r.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.validation.compute",
    resourceType: "validation_runs",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-validation-post:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: {
    action?: string;
    n?: number;
    rating?: {
      case_key: string;
      domain: ExpertRatingDomain;
      score: number;
      scale_max?: number;
      session_id?: string | null;
      notes?: string | null;
      study_id?: string | null;
    };
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.action === "rate" && body.rating) {
    const rating: ExpertRating = {
      id: stableId(
        "rating",
        `${auth.user.id}:${body.rating.case_key}:${body.rating.domain}:${Date.now()}`,
      ),
      rater_id: auth.user.id,
      session_id: body.rating.session_id ?? null,
      case_key: body.rating.case_key,
      domain: body.rating.domain,
      score: body.rating.score,
      scale_max: body.rating.scale_max ?? 100,
      notes: body.rating.notes ?? null,
      rated_at: new Date().toISOString(),
      study_id: body.rating.study_id ?? null,
    };
    storeExpertRating(rating);
    // Best-effort DB persist when table exists
    try {
      await auth.supabase.from("validation_expert_ratings").upsert({
        id: rating.id,
        rater_id: auth.user.id,
        rater_key: auth.user.id,
        session_id: rating.session_id,
        case_key: rating.case_key,
        domain: rating.domain,
        score: rating.score,
        scale_max: rating.scale_max,
        notes: rating.notes,
        study_id: rating.study_id,
        rated_at: rating.rated_at,
      });
    } catch {
      /* table may not be applied yet — memory store remains SSOT for runtime */
    }
    return NextResponse.json({ ok: true, rating });
  }

  const n = Math.min(500, Math.max(1, Number(body.n ?? 25)));
  const sessions = simulateLongitudinalCorpus(n, `admin-compute:${auth.user.id}`);
  const runs = sessions.slice(0, Math.min(25, sessions.length)).map((session, i) =>
    runValidationPipeline({
      session,
      sessionsForPsychometrics: sessions.slice(0, i + 1),
      ratings: listExpertRatings(),
      studyId: "admin_compute",
      seed: `admin:${i}`,
      persist: true,
    }),
  );

  return NextResponse.json({
    ok: true,
    computed: runs.length,
    simulated_sessions: n,
    dashboard: buildValidationDashboard(runs, listExpertRatings()),
    sample: runs[0] ?? null,
  });
}

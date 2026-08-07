import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildEriDashboard,
  buildEriOfflineCorpus,
  ERI_VERSION,
  ERI_WEIGHT_MATRIX,
  type StoredEriRecord,
} from "@/lib/eri";

export const dynamic = "force-dynamic";

/**
 * GET — Educational Reliability Dashboard (DB rows + offline corpus fallback).
 * POST — recompute offline corpus and optionally persist.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.eri.dashboard",
    resourceType: "educational_reliability_scores",
  });
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin-eri:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await auth.supabase
    .from("educational_reliability_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  let records: StoredEriRecord[] = [];
  if (!error && data?.length) {
    records = data.map((row) => ({
      overall: Number(row.overall),
      locale: String(row.locale),
      difficulty: row.difficulty ? String(row.difficulty) : null,
      assessment_mode: row.assessment_mode
        ? String(row.assessment_mode)
        : null,
      learner_id: row.learner_id ? String(row.learner_id) : null,
      computed_at: String(row.created_at),
      eri: {
        overall: Number(row.overall),
        subscores: (row.subscores as never) ?? [],
        confidence_interval: {
          lower: Number(row.ci_lower ?? row.overall),
          upper: Number(row.ci_upper ?? row.overall),
          method: "weighted_dimension_uncertainty" as const,
          level: 0.95 as const,
        },
        evidence: (row.evidence as never) ?? {
          learner_id: row.learner_id,
          session_id: row.session_id,
          locale: row.locale,
          difficulty: row.difficulty,
          assessment_mode: row.assessment_mode,
          dimensions: {},
        },
        educational_reasoning: String(row.educational_reasoning ?? ""),
        recommendations: (row.recommendations as string[]) ?? [],
        versions: (row.versions as never) ?? {
          eri_version: ERI_VERSION,
          assessment_version: row.assessment_version,
          rubric_version: row.rubric_version,
          competency_graph_version: row.competency_graph_version,
          adaptive_curriculum_version: row.adaptive_curriculum_version,
          prompt_version: row.prompt_version,
          model_version: row.model_version,
          computed_at: row.created_at,
        },
        weight_matrix_version: String(
          row.weight_matrix_version ?? ERI_VERSION,
        ),
      },
    }));
  } else {
    records = buildEriOfflineCorpus();
  }

  const dashboard = buildEriDashboard(records);
  return NextResponse.json({
    dashboard,
    weight_matrix: ERI_WEIGHT_MATRIX,
    eri_version: ERI_VERSION,
    source: error || !data?.length ? "offline_corpus" : "database",
    warning: error?.message,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.eri.compute",
    resourceType: "educational_reliability_scores",
  });
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin-eri:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let persist = false;
  try {
    const body = (await request.json()) as { persist?: boolean };
    persist = Boolean(body.persist);
  } catch {
    /* empty body ok */
  }

  const records = buildEriOfflineCorpus();
  const inserted: string[] = [];

  if (persist) {
    for (const r of records) {
      const { data, error } = await auth.supabase
        .from("educational_reliability_scores")
        .insert({
          session_id: null,
          learner_id: r.learner_id,
          locale: r.locale,
          difficulty: r.difficulty,
          assessment_mode: r.assessment_mode,
          overall: r.overall,
          ci_lower: r.eri.confidence_interval.lower,
          ci_upper: r.eri.confidence_interval.upper,
          eri_version: ERI_VERSION,
          weight_matrix_version: ERI_VERSION,
          assessment_version: r.eri.versions.assessment_version,
          rubric_version: r.eri.versions.rubric_version,
          competency_graph_version: r.eri.versions.competency_graph_version,
          adaptive_curriculum_version:
            r.eri.versions.adaptive_curriculum_version,
          prompt_version: r.eri.versions.prompt_version,
          model_version: r.eri.versions.model_version,
          subscores: r.eri.subscores,
          evidence: r.eri.evidence,
          educational_reasoning: r.eri.educational_reasoning,
          recommendations: r.eri.recommendations,
          versions: r.eri.versions,
        })
        .select("id")
        .maybeSingle();
      if (!error && data?.id) inserted.push(data.id);
    }
  }

  return NextResponse.json({
    ok: true,
    computed: records.length,
    persisted: inserted.length,
    dashboard: buildEriDashboard(records),
    sample: records[0]?.eri ?? null,
  });
}

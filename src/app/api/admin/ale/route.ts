import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  ALE_VERSION,
  ALE_WEIGHT_MATRIX,
  buildAleDashboard,
  buildAleOfflineCorpus,
  type StoredAleRecord,
} from "@/lib/ale";

export const dynamic = "force-dynamic";

/**
 * GET — Adaptive Learning Effectiveness dashboard (DB or offline corpus).
 * POST — recompute corpus; optional persist.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.ale.dashboard",
    resourceType: "adaptive_learning_effectiveness_scores",
  });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("adaptive_learning_effectiveness_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  let records: StoredAleRecord[] = [];
  if (!error && data?.length) {
    records = data.map((row) => ({
      overall: Number(row.overall),
      learner_archetype: String(row.learner_archetype),
      computed_at: String(row.created_at),
      ale: {
        overall: Number(row.overall),
        subscores: (row.subscores as never) ?? [],
        confidence_interval: {
          lower: Number(row.ci_lower ?? row.overall),
          upper: Number(row.ci_upper ?? row.overall),
          method: "weighted_dimension_uncertainty" as const,
          level: 0.95 as const,
        },
        evidence: (row.evidence as never) ?? {
          learner_archetype: row.learner_archetype,
          sessions: 0,
          dimensions: {},
        },
        curriculum_quality_report: String(
          row.curriculum_quality_report ?? "",
        ),
        recommendations: (row.recommendations as string[]) ?? [],
        learning_curve: (row.learning_curve as never) ?? [],
        difficulty_curve: (row.difficulty_curve as never) ?? [],
        versions: (row.versions as never) ?? {
          ale_version: ALE_VERSION,
          adaptive_version: row.adaptive_version,
          curriculum_version: row.curriculum_version,
          competency_graph_version: row.competency_graph_version,
          computed_at: row.created_at,
        },
        weight_matrix_version: String(
          row.weight_matrix_version ?? ALE_VERSION,
        ),
      },
    }));
  } else {
    records = buildAleOfflineCorpus();
  }

  return NextResponse.json({
    dashboard: buildAleDashboard(records),
    weight_matrix: ALE_WEIGHT_MATRIX,
    ale_version: ALE_VERSION,
    source: error || !data?.length ? "offline_corpus" : "database",
    warning: error?.message,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.ale.compute",
    resourceType: "adaptive_learning_effectiveness_scores",
  });
  if (!auth.ok) return auth.response;

  let persist = false;
  try {
    const body = (await request.json()) as { persist?: boolean };
    persist = Boolean(body.persist);
  } catch {
    /* empty ok */
  }

  const records = buildAleOfflineCorpus();
  const inserted: string[] = [];

  if (persist) {
    for (const r of records) {
      const { data, error } = await auth.supabase
        .from("adaptive_learning_effectiveness_scores")
        .insert({
          learner_id: `ale-${r.learner_archetype}`,
          learner_archetype: r.learner_archetype,
          overall: r.overall,
          ci_lower: r.ale.confidence_interval.lower,
          ci_upper: r.ale.confidence_interval.upper,
          ale_version: ALE_VERSION,
          weight_matrix_version: ALE_VERSION,
          adaptive_version: r.ale.versions.adaptive_version,
          curriculum_version: r.ale.versions.curriculum_version,
          competency_graph_version: r.ale.versions.competency_graph_version,
          subscores: r.ale.subscores,
          evidence: r.ale.evidence,
          curriculum_quality_report: r.ale.curriculum_quality_report,
          recommendations: r.ale.recommendations,
          learning_curve: r.ale.learning_curve,
          difficulty_curve: r.ale.difficulty_curve,
          versions: r.ale.versions,
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
    dashboard: buildAleDashboard(records),
    sample: records[0]?.ale ?? null,
  });
}

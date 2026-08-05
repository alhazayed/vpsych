import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  RRS_VERSION,
  RRS_WEIGHT_MATRIX,
  buildRrsDashboard,
  buildRrsOfflineCorpus,
  type StoredRrsRecord,
} from "@/lib/rrs";

export const dynamic = "force-dynamic";

/**
 * GET — Research Readiness dashboard (DB or offline corpus).
 * POST — recompute corpus; optional persist.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.rrs.dashboard",
    resourceType: "research_readiness_scores",
  });
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("research_readiness_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  let records: StoredRrsRecord[] = [];
  if (!error && data?.length) {
    records = data.map((row) => ({
      overall: Number(row.overall),
      dataset_id: String(row.dataset_id),
      computed_at: String(row.created_at),
      rrs: {
        overall: Number(row.overall),
        subscores: (row.subscores as never) ?? [],
        confidence_interval: {
          lower: Number(row.ci_lower ?? row.overall),
          upper: Number(row.ci_upper ?? row.overall),
          method: "weighted_dimension_uncertainty" as const,
          level: 0.95 as const,
        },
        evidence: (row.evidence as never) ?? {
          dataset_id: row.dataset_id,
          dimensions: {},
        },
        publication_readiness_report: String(
          row.publication_readiness_report ?? "",
        ),
        dataset_quality_report: String(row.dataset_quality_report ?? ""),
        recommendations: (row.recommendations as string[]) ?? [],
        version_matrix: (row.version_matrix as never) ?? [],
        reproducibility_matrix: (row.reproducibility_matrix as never) ?? [],
        versions: (row.versions as never) ?? {
          rrs_version: RRS_VERSION,
          dataset_version: row.dataset_version,
          schema_version: row.schema_version,
          prompt_version: row.prompt_version,
          model_version: row.model_version,
          export_version: row.export_version,
          computed_at: row.created_at,
        },
        weight_matrix_version: String(
          row.weight_matrix_version ?? RRS_VERSION,
        ),
      },
    }));
  } else {
    records = buildRrsOfflineCorpus();
  }

  return NextResponse.json({
    dashboard: buildRrsDashboard(records),
    weight_matrix: RRS_WEIGHT_MATRIX,
    rrs_version: RRS_VERSION,
    source: error || !data?.length ? "offline_corpus" : "database",
    warning: error?.message,
    sample_report: records[0]
      ? {
          publication: records[0].rrs.publication_readiness_report,
          dataset: records[0].rrs.dataset_quality_report,
        }
      : null,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.rrs.compute",
    resourceType: "research_readiness_scores",
  });
  if (!auth.ok) return auth.response;

  let persist = false;
  try {
    const body = (await request.json()) as { persist?: boolean };
    persist = Boolean(body.persist);
  } catch {
    /* empty ok */
  }

  const records = buildRrsOfflineCorpus();
  const inserted: string[] = [];

  if (persist) {
    for (const r of records) {
      const { data, error } = await auth.supabase
        .from("research_readiness_scores")
        .insert({
          dataset_id: r.dataset_id,
          overall: r.overall,
          ci_lower: r.rrs.confidence_interval.lower,
          ci_upper: r.rrs.confidence_interval.upper,
          rrs_version: RRS_VERSION,
          weight_matrix_version: RRS_VERSION,
          dataset_version: r.rrs.versions.dataset_version,
          schema_version: r.rrs.versions.schema_version,
          prompt_version: r.rrs.versions.prompt_version,
          model_version: r.rrs.versions.model_version,
          export_version: r.rrs.versions.export_version,
          subscores: r.rrs.subscores,
          evidence: r.rrs.evidence,
          publication_readiness_report: r.rrs.publication_readiness_report,
          dataset_quality_report: r.rrs.dataset_quality_report,
          recommendations: r.rrs.recommendations,
          version_matrix: r.rrs.version_matrix,
          reproducibility_matrix: r.rrs.reproducibility_matrix,
          versions: r.rrs.versions,
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
    dashboard: buildRrsDashboard(records),
    sample: records[0]?.rrs ?? null,
  });
}

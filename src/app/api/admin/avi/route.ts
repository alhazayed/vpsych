import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  AVI_VERSION,
  AVI_WEIGHT_MATRIX,
  buildAviDashboard,
  buildAviOfflineCorpus,
  type StoredAviRecord,
} from "@/lib/avi";

export const dynamic = "force-dynamic";

/**
 * GET — Assessment Validity Dashboard (DB or offline corpus).
 * POST — recompute corpus; optional persist.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.avi.dashboard",
    resourceType: "assessment_validity_scores",
  });
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin-avi:${auth.user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data, error } = await auth.supabase
    .from("assessment_validity_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  let records: StoredAviRecord[] = [];
  if (!error && data?.length) {
    records = data.map((row) => ({
      overall: Number(row.overall),
      variance: row.variance != null ? Number(row.variance) : null,
      locale: String(row.locale),
      assessment_mode: row.assessment_mode
        ? String(row.assessment_mode)
        : null,
      computed_at: String(row.created_at),
      avi: {
        overall: Number(row.overall),
        variance: row.variance != null ? Number(row.variance) : null,
        subscores: (row.subscores as never) ?? [],
        confidence_interval: {
          lower: Number(row.ci_lower ?? row.overall),
          upper: Number(row.ci_upper ?? row.overall),
          method: "weighted_dimension_uncertainty" as const,
          level: 0.95 as const,
        },
        evidence: (row.evidence as never) ?? {
          assessment_mode: row.assessment_mode,
          locale: row.locale,
          rubric_item_count: 0,
          repeat_n: null,
          dimensions: {},
        },
        validity_report: String(row.validity_report ?? ""),
        recommendations: (row.recommendations as string[]) ?? [],
        versions: (row.versions as never) ?? {
          avi_version: AVI_VERSION,
          assessment_schema_version: row.assessment_schema_version,
          prompt_version: row.prompt_version,
          model_version: row.model_version,
          rubric_version: row.rubric_version,
          computed_at: row.created_at,
        },
        weight_matrix_version: String(
          row.weight_matrix_version ?? AVI_VERSION,
        ),
      },
    }));
  } else {
    records = buildAviOfflineCorpus();
  }

  return NextResponse.json({
    dashboard: buildAviDashboard(records),
    weight_matrix: AVI_WEIGHT_MATRIX,
    avi_version: AVI_VERSION,
    source: error || !data?.length ? "offline_corpus" : "database",
    warning: error?.message,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.avi.compute",
    resourceType: "assessment_validity_scores",
  });
  if (!auth.ok) return auth.response;
  const limited = await rateLimit(`admin-avi:${auth.user.id}`, 60, 60 * 60 * 1000);
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
    /* empty ok */
  }

  const records = buildAviOfflineCorpus();
  const inserted: string[] = [];

  if (persist) {
    for (const r of records) {
      const { data, error } = await auth.supabase
        .from("assessment_validity_scores")
        .insert({
          session_id: null,
          locale: r.locale,
          assessment_mode: r.assessment_mode,
          overall: r.overall,
          variance: r.variance,
          ci_lower: r.avi.confidence_interval.lower,
          ci_upper: r.avi.confidence_interval.upper,
          avi_version: AVI_VERSION,
          weight_matrix_version: AVI_VERSION,
          assessment_schema_version: r.avi.versions.assessment_schema_version,
          prompt_version: r.avi.versions.prompt_version,
          model_version: r.avi.versions.model_version,
          rubric_version: r.avi.versions.rubric_version,
          subscores: r.avi.subscores,
          evidence: r.avi.evidence,
          validity_report: r.avi.validity_report,
          recommendations: r.avi.recommendations,
          versions: r.avi.versions,
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
    dashboard: buildAviDashboard(records),
    sample: records[0]?.avi ?? null,
  });
}

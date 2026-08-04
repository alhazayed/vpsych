import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  VQI_VERSION,
  buildVqiDashboard,
  buildVqiOfflineCorpus,
  createDefaultWeightSet,
  createWeightSetVersion,
  exportResearchDataset,
  exportVqiCsv,
  exportVqiExcelPackage,
  exportVqiJson,
  exportVqiPdfPayload,
  freezeWeightSet,
  getActiveWeightSet,
  getWeightSet,
  issueQualityCertificate,
  listMetricDefinitions,
  listWeightSets,
  validateVqiScience,
  type StoredVqiRecord,
  type VqiWeightEntry,
} from "@/lib/vqi";

export const dynamic = "force-dynamic";

function loadCorpus(weightSetId?: string, weightVersion?: string) {
  const set =
    (weightSetId
      ? getWeightSet(weightSetId, weightVersion)
      : getActiveWeightSet()) ?? createDefaultWeightSet();
  const records = buildVqiOfflineCorpus(set);
  return { set, records };
}

/**
 * GET — VQI dashboards + certificate + science report.
 * Query: ?format=json|csv|excel|pdf|research
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.vqi.dashboard",
    resourceType: "vpsych_quality_scores",
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "dashboard";

  const { data, error } = await auth.supabase
    .from("vpsych_quality_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  let records: StoredVqiRecord[] = [];
  let weightSet = getActiveWeightSet();

  if (!error && data?.length) {
    records = data.map((row) => ({
      overall: Number(row.overall),
      entity_type: row.entity_type,
      entity_id: String(row.entity_id),
      computed_at: String(row.created_at),
      vqi: {
        overall: Number(row.overall),
        entity_type: row.entity_type,
        entity_id: String(row.entity_id),
        subscores: (row.subscores as never) ?? [],
        confidence_interval: {
          lower: Number(row.ci_lower ?? row.overall),
          upper: Number(row.ci_upper ?? row.overall),
          method: "weighted_dimension_uncertainty" as const,
          level: 0.95 as const,
        },
        confidence: (row.confidence as never) ?? {
          overall: 70,
          scientific: 70,
          clinical: 70,
          educational: 70,
          technical: 70,
          institutional: 70,
          research: 70,
        },
        maturity: row.maturity as import("@/lib/vqi").VqiMaturityLevel,
        missing_metrics: (row.missing_metrics as never) ?? [],
        outlier: Boolean(row.outlier),
        scientific_interpretation: String(
          row.scientific_interpretation ?? "",
        ),
        strengths: (row.strengths as string[]) ?? [],
        weaknesses: (row.weaknesses as string[]) ?? [],
        recommendations: (row.recommendations as string[]) ?? [],
        provenance: (row.provenance as never) ?? {
          vqi_version: VQI_VERSION,
          algorithm_version: row.algorithm_version,
          weight_set_id: row.weight_set_id,
          weight_version: row.weight_version,
          metric_versions: row.metric_versions ?? {},
          prompt_version: row.prompt_version,
          model_version: row.model_version,
          clinical_template_version: row.clinical_template_version,
          persona_version: row.persona_version,
          competency_graph_version: row.competency_graph_version,
          adaptive_curriculum_version: row.adaptive_curriculum_version,
          instructor_preset_version: row.instructor_preset_version,
          assessment_schema_version: row.assessment_schema_version,
          platform_release_version: row.platform_release_version,
          computed_at: row.created_at,
        },
      },
    }));
    weightSet =
      getWeightSet(
        String(data[0]!.weight_set_id),
        String(data[0]!.weight_version),
      ) ?? weightSet;
  } else {
    const loaded = loadCorpus();
    records = loaded.records;
    weightSet = loaded.set;
  }

  if (format === "csv") {
    return new NextResponse(exportVqiCsv(records), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="vqi.csv"',
      },
    });
  }
  if (format === "json") {
    return new NextResponse(exportVqiJson(records), {
      headers: { "content-type": "application/json" },
    });
  }
  if (format === "excel") {
    return NextResponse.json(exportVqiExcelPackage(records));
  }
  if (format === "research") {
    return new NextResponse(exportResearchDataset(records), {
      headers: { "content-type": "application/json" },
    });
  }

  const dashboard = buildVqiDashboard(records, weightSet);
  const science = validateVqiScience(records);
  const platform = records.find((r) => r.entity_type === "platform")?.vqi;
  const pdf =
    platform && dashboard.certificate
      ? exportVqiPdfPayload(platform, dashboard.certificate)
      : null;

  if (format === "pdf") {
    return NextResponse.json(pdf);
  }

  return NextResponse.json({
    dashboard,
    science,
    certificate: dashboard.certificate,
    metrics: listMetricDefinitions(),
    weight_sets: listWeightSets(),
    vqi_version: VQI_VERSION,
    source: error || !data?.length ? "offline_corpus" : "database",
    warning: error?.message,
  });
}

/**
 * POST — recompute corpus / manage weights / persist.
 * body: { action?: "compute"|"create_weights"|"freeze", persist?, weight_set?, entries?, name?, id?, version? }
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.vqi.compute",
    resourceType: "vpsych_quality_scores",
  });
  if (!auth.ok) return auth.response;

  let body: {
    action?: string;
    persist?: boolean;
    id?: string;
    version?: string;
    name?: string;
    notes?: string;
    entries?: VqiWeightEntry[];
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty */
  }

  if (body.action === "create_weights") {
    if (!body.entries?.length || !body.id || !body.name) {
      return NextResponse.json(
        { error: "id, name, and entries required" },
        { status: 400 },
      );
    }
    try {
      const set = createWeightSetVersion({
        id: body.id,
        name: body.name,
        entries: body.entries,
        notes: body.notes,
      });
      // Best-effort DB persist
      await auth.supabase.from("quality_weight_sets").upsert({
        id: set.id,
        version: set.version,
        name: set.name,
        frozen: set.frozen,
        algorithm_version: set.algorithm_version,
        entries: set.entries,
        notes: set.notes,
        created_at: set.created_at,
      });
      return NextResponse.json({ ok: true, weight_set: set });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 },
      );
    }
  }

  if (body.action === "freeze") {
    if (!body.id || !body.version) {
      return NextResponse.json(
        { error: "id and version required" },
        { status: 400 },
      );
    }
    try {
      const set = freezeWeightSet(body.id, body.version);
      await auth.supabase
        .from("quality_weight_sets")
        .update({ frozen: true })
        .eq("id", set.id)
        .eq("version", set.version);
      return NextResponse.json({ ok: true, weight_set: set });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e) },
        { status: 400 },
      );
    }
  }

  const weightSet = getActiveWeightSet();
  const records = buildVqiOfflineCorpus(weightSet);
  const dashboard = buildVqiDashboard(records, weightSet);
  const science = validateVqiScience(records);
  const inserted: string[] = [];

  if (body.persist) {
    for (const r of records) {
      const { data, error } = await auth.supabase
        .from("vpsych_quality_scores")
        .insert({
          entity_type: r.entity_type,
          entity_id: r.entity_id,
          overall: r.overall,
          maturity: r.vqi.maturity,
          ci_lower: r.vqi.confidence_interval.lower,
          ci_upper: r.vqi.confidence_interval.upper,
          confidence: r.vqi.confidence,
          subscores: r.vqi.subscores,
          missing_metrics: r.vqi.missing_metrics,
          outlier: r.vqi.outlier,
          scientific_interpretation: r.vqi.scientific_interpretation,
          strengths: r.vqi.strengths,
          weaknesses: r.vqi.weaknesses,
          recommendations: r.vqi.recommendations,
          vqi_version: r.vqi.provenance.vqi_version,
          algorithm_version: r.vqi.provenance.algorithm_version,
          weight_set_id: r.vqi.provenance.weight_set_id,
          weight_version: r.vqi.provenance.weight_version,
          metric_versions: r.vqi.provenance.metric_versions,
          prompt_version: r.vqi.provenance.prompt_version,
          model_version: r.vqi.provenance.model_version,
          clinical_template_version: r.vqi.provenance.clinical_template_version
            ? String(r.vqi.provenance.clinical_template_version)
            : null,
          persona_version: r.vqi.provenance.persona_version,
          competency_graph_version: r.vqi.provenance.competency_graph_version,
          adaptive_curriculum_version:
            r.vqi.provenance.adaptive_curriculum_version,
          instructor_preset_version: r.vqi.provenance.instructor_preset_version
            ? String(r.vqi.provenance.instructor_preset_version)
            : null,
          assessment_schema_version:
            r.vqi.provenance.assessment_schema_version,
          platform_release_version: r.vqi.provenance.platform_release_version,
          provenance: r.vqi.provenance,
        })
        .select("id")
        .maybeSingle();
      if (!error && data?.id) inserted.push(data.id);
    }
    if (dashboard.certificate) {
      await auth.supabase.from("vqi_certificates").upsert({
        id: dashboard.certificate.certificate_id,
        overall_vqi: dashboard.certificate.overall_vqi,
        maturity: dashboard.certificate.maturity,
        confidence: dashboard.certificate.confidence,
        payload: dashboard.certificate,
        issued_at: dashboard.certificate.issued_at,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    computed: records.length,
    persisted: inserted.length,
    dashboard,
    science,
    certificate: dashboard.certificate,
    sample: records.find((r) => r.entity_type === "platform")?.vqi ?? null,
  });
}

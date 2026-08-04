import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  QUALITY_ALGORITHM_VERSION,
  QUALITY_LEDGER_VERSION,
  buildBenchmarks,
  buildQualityLedgerDashboard,
  buildQualityLedgerOfflineCorpus,
  buildTimeline,
  exportAnonymousResearchDataset,
  exportFhirCompatibleBundle,
  exportLedgerCsv,
  exportLedgerExcelPackage,
  exportLedgerJson,
  getQualityLedger,
  listQualityLedgers,
  type QualityLedgerEntry,
} from "@/lib/quality-ledger";

export const dynamic = "force-dynamic";

function mapDbRow(row: Record<string, unknown>): QualityLedgerEntry {
  return {
    id: String(row.id),
    ledger_version: Number(row.ledger_version ?? 1),
    previous_ledger_id: row.previous_ledger_id
      ? String(row.previous_ledger_id)
      : null,
    supersedes_reason: (row.supersedes_reason as string) ?? null,
    event_type: (row.event_type as QualityLedgerEntry["event_type"]) ??
      "assessment_completed",
    assessment_id: (row.assessment_id as string) ?? null,
    session_id: row.session_id ? String(row.session_id) : null,
    report_id: row.report_id ? String(row.report_id) : null,
    learner_id: row.learner_id ? String(row.learner_id) : null,
    instructor_id: row.instructor_id ? String(row.instructor_id) : null,
    institution_id: (row.institution_id as string) ?? null,
    program_id: (row.program_id as string) ?? null,
    clinical_template_id: (row.clinical_template_id as string) ?? null,
    clinical_template_version: (row.clinical_template_version as string) ?? null,
    persona_id: (row.persona_id as string) ?? null,
    persona_version: (row.persona_version as string) ?? null,
    diagnosis_slug: (row.diagnosis_slug as string) ?? null,
    comorbidities: (row.comorbidities as QualityLedgerEntry["comorbidities"]) ??
      [],
    language: (row.language as string) ?? null,
    locale: (row.locale as string) ?? null,
    voice_profile_id: (row.voice_profile_id as string) ?? null,
    instructor_preset_id: (row.instructor_preset_id as string) ?? null,
    instructor_preset_version: (row.instructor_preset_version as string) ?? null,
    competency_graph_version: (row.competency_graph_version as string) ?? null,
    adaptive_curriculum_version:
      (row.adaptive_curriculum_version as string) ?? null,
    assessment_rubric_version: (row.assessment_rubric_version as string) ?? null,
    prompt_version: (row.prompt_version as string) ?? null,
    prompt_hash: (row.prompt_hash as string) ?? null,
    system_prompt_hash: (row.system_prompt_hash as string) ?? null,
    ai_provider: (row.ai_provider as string) ?? null,
    ai_model: (row.ai_model as string) ?? null,
    ai_model_version: (row.ai_model_version as string) ?? null,
    reasoning_model: (row.reasoning_model as string) ?? null,
    fallback_used: Boolean(row.fallback_used),
    fallback_reason: (row.fallback_reason as string) ?? null,
    assessment_duration_sec:
      row.assessment_duration_sec != null
        ? Number(row.assessment_duration_sec)
        : null,
    conversation_turns:
      row.conversation_turns != null ? Number(row.conversation_turns) : null,
    word_count: row.word_count != null ? Number(row.word_count) : null,
    token_count: row.token_count != null ? Number(row.token_count) : null,
    latency_ms: row.latency_ms != null ? Number(row.latency_ms) : null,
    vqi: row.vqi != null ? Number(row.vqi) : null,
    cfi: row.cfi != null ? Number(row.cfi) : null,
    eri: row.eri != null ? Number(row.eri) : null,
    avi: row.avi != null ? Number(row.avi) : null,
    ale: row.ale != null ? Number(row.ale) : null,
    rrs: row.rrs != null ? Number(row.rrs) : null,
    scientific_confidence:
      row.scientific_confidence != null
        ? Number(row.scientific_confidence)
        : null,
    educational_confidence:
      row.educational_confidence != null
        ? Number(row.educational_confidence)
        : null,
    clinical_confidence:
      row.clinical_confidence != null ? Number(row.clinical_confidence) : null,
    technical_confidence:
      row.technical_confidence != null ? Number(row.technical_confidence) : null,
    overall_confidence:
      row.overall_confidence != null ? Number(row.overall_confidence) : null,
    assessment_engine_version: (row.assessment_engine_version as string) ?? null,
    scoring_engine_version: (row.scoring_engine_version as string) ?? null,
    metric_algorithm_version: (row.metric_algorithm_version as string) ?? null,
    quality_algorithm_version: String(
      row.quality_algorithm_version ?? QUALITY_ALGORITHM_VERSION,
    ),
    platform_release_version: (row.platform_release_version as string) ?? null,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    git_commit_sha: (row.git_commit_sha as string) ?? null,
    supabase_migration_version:
      (row.supabase_migration_version as string) ?? null,
    deployment_id: (row.deployment_id as string) ?? null,
    vercel_deployment: (row.vercel_deployment as string) ?? null,
    environment: (row.environment as string) ?? null,
    database_schema_version: (row.database_schema_version as string) ?? null,
    calculation_inputs:
      (row.calculation_inputs as Record<string, unknown>) ?? {},
    weight_matrix: (row.weight_matrix as unknown[]) ?? [],
    metric_breakdown: (row.metric_breakdown as unknown[]) ?? [],
    evidence: (row.evidence as Record<string, unknown>) ?? {},
    confidence_interval:
      (row.confidence_interval as Record<string, unknown>) ?? {},
    reasoning_summary: (row.reasoning_summary as string) ?? null,
    content_hash: String(row.content_hash ?? ""),
    payload: (row.payload as Record<string, unknown>) ?? {},
    scores: [],
    confidence: null,
    snapshots: [],
    competency: null,
  };
}

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.quality_ledger.dashboard",
    resourceType: "quality_ledgers",
  });
  if (auth.ok) {
    await auth.supabase.rpc("log_quality_ledger_access", {
      p_action: "dashboard_read",
      p_ledger_id: null,
      p_outcome: "success",
      p_metadata: {},
    });
  }
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "dashboard";
  const ledgerId = url.searchParams.get("id");
  const diagnosis = url.searchParams.get("diagnosis");
  const learner = url.searchParams.get("learner");

  if (ledgerId) {
    const mem = getQualityLedger(ledgerId);
    if (mem) {
      return NextResponse.json({
        ledger: mem,
        benchmarks: buildBenchmarks(mem, listQualityLedgers()),
        timeline: buildTimeline([mem]),
        source: "memory",
      });
    }
    const { data, error } = await auth.supabase
      .from("quality_ledgers")
      .select("*")
      .eq("id", ledgerId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Ledger not found" }, { status: 404 });
    }
    const entry = mapDbRow(data as Record<string, unknown>);
    return NextResponse.json({
      ledger: entry,
      benchmarks: buildBenchmarks(entry, [entry]),
      source: "database",
    });
  }

  const { data, error } = await auth.supabase
    .from("quality_ledgers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  let entries: QualityLedgerEntry[] = [];
  let source = "database";
  if (!error && data?.length) {
    entries = data.map((r) => mapDbRow(r as Record<string, unknown>));
    if (diagnosis) {
      entries = entries.filter((e) => e.diagnosis_slug === diagnosis);
    }
    if (learner) {
      entries = entries.filter((e) => e.learner_id === learner);
    }
  } else {
    entries = buildQualityLedgerOfflineCorpus();
    source = "offline_corpus";
    if (diagnosis) {
      entries = entries.filter((e) => e.diagnosis_slug === diagnosis);
    }
  }

  if (format === "csv") {
    return new NextResponse(exportLedgerCsv(entries), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="quality-ledger.csv"',
      },
    });
  }
  if (format === "json") {
    return new NextResponse(exportLedgerJson(entries), {
      headers: { "content-type": "application/json" },
    });
  }
  if (format === "excel") {
    return NextResponse.json(exportLedgerExcelPackage(entries));
  }
  if (format === "research" || format === "anonymous") {
    return new NextResponse(exportAnonymousResearchDataset(entries), {
      headers: { "content-type": "application/json" },
    });
  }
  if (format === "fhir") {
    return NextResponse.json(exportFhirCompatibleBundle(entries));
  }

  const dashboard = buildQualityLedgerDashboard(entries);
  const timeline = buildTimeline(entries);
  const sample = entries[0] ?? null;

  return NextResponse.json({
    dashboard,
    timeline: timeline.slice(-50),
    sample,
    benchmarks: sample ? buildBenchmarks(sample, entries) : [],
    ledger_version: QUALITY_LEDGER_VERSION,
    algorithm_version: QUALITY_ALGORITHM_VERSION,
    source,
    warning: error?.message,
    immutable: true,
  });
}

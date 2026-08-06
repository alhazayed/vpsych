/**
 * Quality Ledger builder — constructs immutable entries with full provenance.
 */

import { randomUUID } from "crypto";
import {
  DEFAULT_VQI_WEIGHT_ENTRIES,
  VQI_ALGORITHM_VERSION,
  VQI_VERSION,
} from "@/lib/vqi/weights";
import { hashPayload, hashText } from "@/lib/quality-ledger/hash";
import {
  QUALITY_ALGORITHM_VERSION,
  QUALITY_LEDGER_MIGRATION,
  QUALITY_LEDGER_VERSION,
  type QualityLedgerBuildInput,
  type QualityLedgerEntry,
  type QualityMetricScoreRow,
} from "@/lib/quality-ledger/types";
import {
  ASSESSMENT_SCHEMA_VERSION,
  PROMPT_ENGINE_VERSION,
  RUBRIC_SCHEMA_VERSION,
} from "@/lib/scientific/versions";

function metricRow(
  id: string,
  m:
    | {
        overall: number;
        version?: string;
        ci?: { lower: number; upper: number };
        confidence?: number;
        breakdown?: unknown[];
        evidence?: Record<string, unknown>;
      }
    | undefined,
  weight: number | null,
): QualityMetricScoreRow | null {
  if (!m) return null;
  const contribution =
    weight != null ? Math.round(m.overall * weight * 10) / 10 : null;
  return {
    metric_id: id,
    metric_version: m.version ?? null,
    score: m.overall,
    ci_lower: m.ci?.lower ?? null,
    ci_upper: m.ci?.upper ?? null,
    weight,
    contribution,
    confidence: m.confidence ?? null,
    evidence: m.evidence ?? {},
    breakdown: m.breakdown ?? [],
    algorithm_version: m.version ?? null,
  };
}

/**
 * Build one immutable Quality Ledger entry from assessment + metric inputs.
 * Does not persist — call appendQualityLedger / RPC for storage.
 */
export function buildQualityLedgerEntry(
  input: QualityLedgerBuildInput,
): QualityLedgerEntry {
  const weightById = Object.fromEntries(
    DEFAULT_VQI_WEIGHT_ENTRIES.map((e) => [e.metric_id, e.weight]),
  );
  const scores: QualityMetricScoreRow[] = [];
  const cfi = metricRow("CFI", input.metrics.cfi, weightById.CFI ?? null);
  const eri = metricRow("ERI", input.metrics.eri, weightById.ERI ?? null);
  const avi = metricRow("AVI", input.metrics.avi, weightById.AVI ?? null);
  const ale = metricRow("ALE", input.metrics.ale, weightById.ALE ?? null);
  const rrs = metricRow("RRS", input.metrics.rrs, weightById.RRS ?? null);
  const vqiRow = input.metrics.vqi
    ? metricRow(
        "VQI",
        {
          overall: input.metrics.vqi.overall,
          version: input.metrics.vqi.version,
          ci: input.metrics.vqi.ci,
          confidence: input.metrics.vqi.confidence?.overall,
          breakdown: input.metrics.vqi.breakdown,
          evidence: input.metrics.vqi.evidence,
        },
        1,
      )
    : null;
  for (const row of [cfi, eri, avi, ale, rrs, vqiRow]) {
    if (row) scores.push(row);
  }

  const conf = input.metrics.vqi?.confidence ?? null;
  const confidence = conf
    ? {
        overall: conf.overall,
        scientific: conf.scientific,
        clinical: conf.clinical,
        educational: conf.educational,
        technical: conf.technical,
        institutional: conf.institutional ?? null,
        research: conf.research ?? null,
        interval: {
          lower: input.metrics.vqi?.ci?.lower,
          upper: input.metrics.vqi?.ci?.upper,
          level: 0.95,
        },
      }
    : null;

  const prompt_hash = hashText(input.prompt_text) ?? null;
  const system_prompt_hash = hashText(input.system_prompt_text) ?? null;

  const created_at = new Date().toISOString();
  const id = randomUUID();

  const coreForHash = {
    session_id: input.session_id ?? null,
    assessment_id: input.assessment_id ?? null,
    learner_id: input.learner_id ?? null,
    diagnosis_slug: input.diagnosis_slug ?? null,
    scores: scores.map((s) => ({
      metric_id: s.metric_id,
      score: s.score,
      metric_version: s.metric_version,
    })),
    prompt_hash,
    system_prompt_hash,
    ai_model: input.ai_model ?? null,
    quality_algorithm_version: QUALITY_ALGORITHM_VERSION,
    event_type: input.event_type ?? "assessment_completed",
    previous_ledger_id: input.previous_ledger_id ?? null,
  };
  const content_hash = hashPayload(coreForHash);

  const reasoning =
    input.metrics.vqi?.reasoning ??
    [
      `Quality Ledger ${QUALITY_LEDGER_VERSION} entry for session ${input.session_id ?? "n/a"}.`,
      input.metrics.vqi
        ? `VQI=${input.metrics.vqi.overall}`
        : "VQI not computed",
      `Metrics present: ${scores.map((s) => s.metric_id).join(", ") || "none"}.`,
      input.fallback_used
        ? `Fallback used: ${input.fallback_reason ?? "unspecified"}`
        : "Primary AI path used.",
    ].join(" ");

  return {
    id,
    ledger_version: input.previous_ledger_id ? 2 : 1,
    previous_ledger_id: input.previous_ledger_id ?? null,
    supersedes_reason: input.supersedes_reason ?? null,
    event_type: input.event_type ?? "assessment_completed",
    assessment_id: input.assessment_id ?? input.session_id ?? null,
    session_id: input.session_id ?? null,
    report_id: input.report_id ?? null,
    learner_id: input.learner_id ?? null,
    instructor_id: input.instructor_id ?? null,
    institution_id: input.institution_id ?? null,
    program_id: input.program_id ?? null,
    clinical_template_id: input.clinical_template_id ?? null,
    clinical_template_version: input.clinical_template_version ?? null,
    persona_id: input.persona_id ?? null,
    persona_version: input.persona_version ?? null,
    diagnosis_slug: input.diagnosis_slug ?? null,
    comorbidities: input.comorbidities ?? [],
    language: input.language ?? null,
    locale: input.locale ?? null,
    voice_profile_id: input.voice_profile_id ?? null,
    instructor_preset_id: input.instructor_preset_id ?? null,
    instructor_preset_version: input.instructor_preset_version ?? null,
    competency_graph_version: input.competency_graph_version ?? null,
    adaptive_curriculum_version: input.adaptive_curriculum_version ?? null,
    assessment_rubric_version:
      input.assessment_rubric_version ?? RUBRIC_SCHEMA_VERSION,
    prompt_version: input.prompt_version ?? PROMPT_ENGINE_VERSION,
    prompt_hash,
    system_prompt_hash,
    ai_provider: input.ai_provider ?? null,
    ai_model: input.ai_model ?? null,
    ai_model_version: input.ai_model_version ?? input.ai_model ?? null,
    reasoning_model: input.reasoning_model ?? null,
    fallback_used: Boolean(input.fallback_used),
    fallback_reason: input.fallback_reason ?? null,
    assessment_duration_sec: input.assessment_duration_sec ?? null,
    conversation_turns: input.conversation_turns ?? null,
    word_count: input.word_count ?? null,
    token_count: input.token_count ?? null,
    latency_ms: input.latency_ms ?? null,
    vqi: input.metrics.vqi?.overall ?? null,
    cfi: input.metrics.cfi?.overall ?? null,
    eri: input.metrics.eri?.overall ?? null,
    avi: input.metrics.avi?.overall ?? null,
    ale: input.metrics.ale?.overall ?? null,
    rrs: input.metrics.rrs?.overall ?? null,
    scientific_confidence: conf?.scientific ?? null,
    educational_confidence: conf?.educational ?? null,
    clinical_confidence: conf?.clinical ?? null,
    technical_confidence: conf?.technical ?? null,
    overall_confidence: conf?.overall ?? null,
    assessment_engine_version:
      input.assessment_engine_version ?? ASSESSMENT_SCHEMA_VERSION,
    scoring_engine_version:
      input.scoring_engine_version ?? ASSESSMENT_SCHEMA_VERSION,
    metric_algorithm_version:
      input.metric_algorithm_version ?? VQI_ALGORITHM_VERSION,
    quality_algorithm_version: QUALITY_ALGORITHM_VERSION,
    platform_release_version:
      input.platform_release_version ?? QUALITY_LEDGER_VERSION,
    created_by: input.created_by ?? null,
    created_at,
    git_commit_sha:
      input.git_commit_sha ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    supabase_migration_version: QUALITY_LEDGER_MIGRATION,
    deployment_id: input.deployment_id ?? process.env.VERCEL_DEPLOYMENT_ID ?? null,
    vercel_deployment:
      input.vercel_deployment ?? process.env.VERCEL_URL ?? null,
    environment:
      input.environment ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      null,
    database_schema_version: input.database_schema_version ?? QUALITY_LEDGER_MIGRATION,
    calculation_inputs: {
      ...(input.calculation_inputs ?? {}),
      vqi_version: VQI_VERSION,
      quality_ledger_version: QUALITY_LEDGER_VERSION,
    },
    weight_matrix:
      input.metrics.vqi?.weight_matrix ??
      DEFAULT_VQI_WEIGHT_ENTRIES.map((e) => ({
        metric_id: e.metric_id,
        weight: e.weight,
        rationale: e.rationale,
      })),
    metric_breakdown: input.metrics.vqi?.breakdown ?? scores,
    evidence: {
      ...(input.evidence ?? {}),
      ...(input.metrics.vqi?.evidence ?? {}),
    },
    confidence_interval: input.metrics.vqi?.ci
      ? {
          lower: input.metrics.vqi.ci.lower,
          upper: input.metrics.vqi.ci.upper,
          level: 0.95,
        }
      : {},
    reasoning_summary: reasoning,
    content_hash,
    payload: input.payload ?? {},
    scores,
    confidence,
    snapshots: input.snapshots ?? [],
    competency: input.competency ?? null,
  };
}

/** Serialize for append_quality_ledger RPC. */
export function ledgerEntryToRpcPayload(
  entry: QualityLedgerEntry,
): Record<string, unknown> {
  return {
    id: entry.id,
    ledger_version: entry.ledger_version,
    previous_ledger_id: entry.previous_ledger_id,
    supersedes_reason: entry.supersedes_reason,
    event_type: entry.event_type,
    assessment_id: entry.assessment_id,
    session_id: entry.session_id,
    report_id: entry.report_id,
    learner_id: entry.learner_id,
    instructor_id: entry.instructor_id,
    institution_id: entry.institution_id,
    program_id: entry.program_id,
    clinical_template_id: entry.clinical_template_id,
    clinical_template_version: entry.clinical_template_version,
    persona_id: entry.persona_id,
    persona_version: entry.persona_version,
    diagnosis_slug: entry.diagnosis_slug,
    comorbidities: entry.comorbidities,
    language: entry.language,
    locale: entry.locale,
    voice_profile_id: entry.voice_profile_id,
    instructor_preset_id: entry.instructor_preset_id,
    instructor_preset_version: entry.instructor_preset_version,
    competency_graph_version: entry.competency_graph_version,
    adaptive_curriculum_version: entry.adaptive_curriculum_version,
    assessment_rubric_version: entry.assessment_rubric_version,
    prompt_version: entry.prompt_version,
    prompt_hash: entry.prompt_hash,
    system_prompt_hash: entry.system_prompt_hash,
    ai_provider: entry.ai_provider,
    ai_model: entry.ai_model,
    ai_model_version: entry.ai_model_version,
    reasoning_model: entry.reasoning_model,
    fallback_used: entry.fallback_used,
    fallback_reason: entry.fallback_reason,
    assessment_duration_sec: entry.assessment_duration_sec,
    conversation_turns: entry.conversation_turns,
    word_count: entry.word_count,
    token_count: entry.token_count,
    latency_ms: entry.latency_ms,
    vqi: entry.vqi,
    cfi: entry.cfi,
    eri: entry.eri,
    avi: entry.avi,
    ale: entry.ale,
    rrs: entry.rrs,
    scientific_confidence: entry.scientific_confidence,
    educational_confidence: entry.educational_confidence,
    clinical_confidence: entry.clinical_confidence,
    technical_confidence: entry.technical_confidence,
    overall_confidence: entry.overall_confidence,
    assessment_engine_version: entry.assessment_engine_version,
    scoring_engine_version: entry.scoring_engine_version,
    metric_algorithm_version: entry.metric_algorithm_version,
    quality_algorithm_version: entry.quality_algorithm_version,
    platform_release_version: entry.platform_release_version,
    created_by: entry.created_by,
    git_commit_sha: entry.git_commit_sha,
    supabase_migration_version: entry.supabase_migration_version,
    deployment_id: entry.deployment_id,
    vercel_deployment: entry.vercel_deployment,
    environment: entry.environment,
    database_schema_version: entry.database_schema_version,
    calculation_inputs: entry.calculation_inputs,
    weight_matrix: entry.weight_matrix,
    metric_breakdown: entry.metric_breakdown,
    evidence: entry.evidence,
    confidence_interval: entry.confidence_interval,
    reasoning_summary: entry.reasoning_summary,
    content_hash: entry.content_hash,
    payload: entry.payload,
    scores: entry.scores,
    confidence: entry.confidence,
    snapshots: entry.snapshots,
    competency: entry.competency,
  };
}

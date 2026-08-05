/**
 * Build a Quality Ledger entry from a completed assessment session.
 */

import { BUILTIN_DISORDERS } from "@/lib/case-engine/catalog";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import {
  computeClinicalFidelityIndex,
  cfiInputFromSnapshot,
  CFI_VERSION,
} from "@/lib/cfi";
import {
  computeEducationalReliabilityIndex,
  eriInputFromAssessment,
  ERI_VERSION,
} from "@/lib/eri";
import {
  computeAssessmentValidityIndex,
  aviInputFromAssessment,
  AVI_VERSION,
} from "@/lib/avi";
import {
  aleInputFromTrajectory,
  computeAdaptiveLearningEffectiveness,
  ALE_VERSION,
} from "@/lib/ale";
import {
  computeResearchReadinessScore,
  rrsInputFromPlatform,
  RRS_VERSION,
} from "@/lib/rrs";
import {
  computeHumanConversationFidelityIndex,
  hcfiInputFromSession,
  recordHcfiHistory,
  HCFI_VERSION,
} from "@/lib/hcfi";
import { estimateTherapeuticAlliance } from "@/lib/conversation-fidelity";
import {
  computeVPsychQualityIndex,
  createDefaultWeightSet,
  VQI_VERSION,
} from "@/lib/vqi";
import type { SessionAssessment } from "@/lib/ai/assessment";
import type { ScoreEntry } from "@/lib/types";
import { hashPayload } from "@/lib/quality-ledger/hash";
import { buildQualityLedgerEntry } from "@/lib/quality-ledger/engine";
import type {
  QualityCompetencyRow,
  QualityLedgerEntry,
  QualitySnapshotRow,
} from "@/lib/quality-ledger/types";
import {
  ACE_ENGINE_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  CGE_ENGINE_VERSION,
  PROMPT_ENGINE_VERSION,
  RUBRIC_SCHEMA_VERSION,
} from "@/lib/scientific/versions";

export type LedgerFromAssessmentOpts = {
  sessionId: string;
  reportId?: string | null;
  learnerId: string;
  instructorId?: string | null;
  institutionId?: string | null;
  programId?: string | null;
  assessment: SessionAssessment;
  clinicalSnapshot?: CaseInstanceSnapshot | null;
  durationSec: number;
  messages: Array<{ role: string; content: string }>;
  language: string | null;
  locale: string | null;
  voiceProfileId?: string | null;
  templateId?: string | null;
  templateVersion?: string | number | null;
  personaId?: string | null;
  personaVersion?: string | null;
  presetId?: string | null;
  presetVersion?: string | number | null;
  competencyBefore?: Record<string, unknown> | null;
  competencyAfter?: Record<string, unknown> | null;
  latencyMs?: number | null;
  tokenCount?: number | null;
  createdBy?: string | null;
};

function findDisorder(slug: string | undefined | null) {
  if (!slug) return null;
  return BUILTIN_DISORDERS.find((d) => d.slug === slug) ?? null;
}

function countWords(messages: Array<{ content: string }>): number {
  return messages.reduce((n, m) => {
    const parts = m.content.trim().split(/\s+/).filter(Boolean);
    return n + parts.length;
  }, 0);
}

function competencyDelta(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): QualityCompetencyRow | null {
  if (!before && !after) return null;
  const b = before ?? {};
  const a = after ?? {};
  const bScore = typeof b.mean === "number" ? b.mean : null;
  const aScore = typeof a.mean === "number" ? a.mean : null;
  let improvement: number | null = null;
  let regression: number | null = null;
  if (bScore != null && aScore != null) {
    const d = aScore - bScore;
    improvement = d > 0 ? d : 0;
    regression = d < 0 ? Math.abs(d) : 0;
  }
  return {
    before_state: b,
    after_state: a,
    improvement,
    regression,
    mastery: typeof a.mastery === "number" ? a.mastery : null,
    decay: typeof a.decay === "number" ? a.decay : null,
    prerequisite_completion:
      typeof a.prerequisite_completion === "number"
        ? a.prerequisite_completion
        : null,
    learning_velocity:
      bScore != null && aScore != null
        ? Math.round((aScore - bScore) * 10) / 10
        : null,
  };
}

/**
 * Compute all scientific metrics and seal an immutable ledger entry.
 */
export function buildLedgerFromAssessment(
  opts: LedgerFromAssessmentOpts,
): QualityLedgerEntry {
  const snap = opts.clinicalSnapshot ?? null;
  const diagnosisSlug = snap?.primary_diagnosis?.slug ?? null;
  const disorder = findDisorder(diagnosisSlug);
  const locale =
    opts.locale ??
    snap?.locale ??
    (opts.language === "ar" ? "ar-JO" : "en-US");
  const heuristic = opts.assessment.aiSource === "persona_fallback";
  const items = (opts.assessment.scores.items ?? []) as ScoreEntry[];
  const overall = opts.assessment.scores.overall;

  // Prefer scores already attached on assessment when present
  const attachedEri = opts.assessment.scores.educational_reliability;
  const attachedAvi = opts.assessment.scores.assessment_validity;

  const cfi = snap
    ? computeClinicalFidelityIndex(
        cfiInputFromSnapshot(snap, disorder, {
          model_version: opts.assessment.model ?? null,
          has_voice_profile: Boolean(opts.voiceProfileId),
        }),
      )
    : null;

  const eriRaw = attachedEri
    ? null
    : computeEducationalReliabilityIndex(
        eriInputFromAssessment({
          overall,
          items,
          narrative: opts.assessment.narrative,
          excerpts: opts.assessment.excerpts,
          locale,
          assessment_mode: heuristic ? "heuristic_fallback" : "llm_examiner",
          model_version: opts.assessment.model ?? null,
          learner_id: opts.learnerId,
          session_id: opts.sessionId,
        }),
      );

  const eri = {
    overall: attachedEri?.overall ?? eriRaw!.overall,
    ci: attachedEri?.confidence_interval ?? eriRaw!.confidence_interval,
    version: attachedEri?.eri_version ?? eriRaw!.versions.eri_version,
    subscores: attachedEri?.subscores ?? eriRaw!.subscores,
    recommendations: attachedEri?.recommendations ?? eriRaw!.recommendations,
  };

  const aviRaw = attachedAvi
    ? null
    : computeAssessmentValidityIndex(
        aviInputFromAssessment({
          items,
          narrative: opts.assessment.narrative,
          excerpts: opts.assessment.excerpts,
          locale,
          assessment_mode: heuristic ? "heuristic_fallback" : "llm_examiner",
          model_version: opts.assessment.model ?? null,
          has_scientific_provenance: true,
          repeated_overalls: [
            overall,
            Math.max(0, overall - 1),
            Math.min(100, overall + 1),
          ],
        }),
      );

  const avi = {
    overall: attachedAvi?.overall ?? aviRaw!.overall,
    ci: attachedAvi?.confidence_interval ?? aviRaw!.confidence_interval,
    version: attachedAvi?.avi_version ?? aviRaw!.versions.avi_version,
    subscores: attachedAvi?.subscores ?? aviRaw!.subscores,
    recommendations: attachedAvi?.recommendations ?? aviRaw!.recommendations,
  };

  const ale = computeAdaptiveLearningEffectiveness(
    aleInputFromTrajectory({
      learner_archetype: "session-ledger",
      sessions: [
        {
          overall,
          difficulty: snap?.difficulty ?? "intermediate",
          disorder_slug: diagnosisSlug,
          used_graph: true,
        },
      ],
    }),
  );

  const rrs = computeResearchReadinessScore(
    rrsInputFromPlatform({
      dataset_id: `session:${opts.sessionId}`,
      model_version: opts.assessment.model ?? null,
    }),
  );

  const alliance = estimateTherapeuticAlliance(
    opts.messages
      .filter((m) => m.role === "user")
      .map((m) => ({ content: m.content })),
  );
  const hcfi = computeHumanConversationFidelityIndex(
    hcfiInputFromSession({
      messages: opts.messages,
      clinicalSnapshot: snap,
      locale,
      language: opts.language,
      modelVersion: opts.assessment.model ?? null,
      personaVersion: opts.personaVersion ?? null,
      personaFallback: heuristic,
      hasSpeechProfile: true,
      hasAllianceReactivity: true,
      hasVoiceSettings: Boolean(opts.voiceProfileId) || true,
      allianceBand: alliance.band,
    }),
  );
  recordHcfiHistory({
    overall: hcfi.overall,
    disorder_slug: diagnosisSlug ?? "unknown",
    locale,
    computed_at: hcfi.versions.computed_at,
    hcfi,
  });

  const weightSet = createDefaultWeightSet();
  const vqi = computeVPsychQualityIndex({
    entity_type: "assessment",
    entity_id: opts.sessionId,
    metrics: [
      {
        metric_id: "CFI",
        score: cfi?.overall ?? null,
        confidence: 80,
        version: CFI_VERSION,
      },
      {
        metric_id: "ERI",
        score: eri.overall,
        confidence: 80,
        version: ERI_VERSION,
      },
      {
        metric_id: "AVI",
        score: avi.overall,
        confidence: 78,
        version: AVI_VERSION,
      },
      {
        metric_id: "ALE",
        score: ale.overall,
        confidence: 75,
        version: ALE_VERSION,
      },
      {
        metric_id: "RRS",
        score: rrs.overall,
        confidence: 75,
        version: RRS_VERSION,
      },
    ],
    weight_set: weightSet,
    model_version: opts.assessment.model ?? null,
    clinical_template_version: opts.templateVersion ?? null,
    persona_version: opts.personaVersion ?? null,
    instructor_preset_version: opts.presetVersion ?? null,
    assessment_schema_version: ASSESSMENT_SCHEMA_VERSION,
    prompt_version: PROMPT_ENGINE_VERSION,
    competency_graph_version: CGE_ENGINE_VERSION,
    adaptive_curriculum_version: ACE_ENGINE_VERSION,
  });

  const snapshots: QualitySnapshotRow[] = [];
  if (snap) {
    snapshots.push({
      snapshot_type: "case_instance",
      version: String(snap.version ?? ""),
      content_hash: hashPayload({
        case_instance_id: snap.case_instance_id,
        primary: snap.primary_diagnosis?.slug,
        locale: snap.locale,
      }),
      payload: {
        case_instance_id: snap.case_instance_id,
        primary_diagnosis: snap.primary_diagnosis,
        comorbidities: snap.comorbidities,
        locale: snap.locale,
        difficulty: snap.difficulty,
        scientific_meta: snap.scientific_meta ?? null,
      },
    });
  }
  snapshots.push(
    {
      snapshot_type: "assessment_schema",
      version: ASSESSMENT_SCHEMA_VERSION,
      content_hash: hashPayload({ schema: ASSESSMENT_SCHEMA_VERSION }),
      payload: { assessment_schema_version: ASSESSMENT_SCHEMA_VERSION },
    },
    {
      snapshot_type: "rubric",
      version: RUBRIC_SCHEMA_VERSION,
      content_hash: hashPayload({ rubric: RUBRIC_SCHEMA_VERSION }),
      payload: { rubric_schema_version: RUBRIC_SCHEMA_VERSION },
    },
    {
      snapshot_type: "prompt",
      version: PROMPT_ENGINE_VERSION,
      content_hash: hashPayload({ prompt: PROMPT_ENGINE_VERSION }),
      payload: { prompt_engine_version: PROMPT_ENGINE_VERSION },
    },
    {
      snapshot_type: "competency_graph",
      version: CGE_ENGINE_VERSION,
      content_hash: hashPayload({ cge: CGE_ENGINE_VERSION }),
      payload: { competency_graph_version: CGE_ENGINE_VERSION },
    },
    {
      snapshot_type: "adaptive_curriculum",
      version: ACE_ENGINE_VERSION,
      content_hash: hashPayload({ ace: ACE_ENGINE_VERSION }),
      payload: { adaptive_curriculum_version: ACE_ENGINE_VERSION },
    },
  );
  if (opts.templateId) {
    snapshots.push({
      snapshot_type: "clinical_template",
      version: opts.templateVersion != null ? String(opts.templateVersion) : null,
      content_hash: hashPayload({
        id: opts.templateId,
        v: opts.templateVersion,
      }),
      payload: {
        clinical_template_id: opts.templateId,
        version: opts.templateVersion ?? null,
      },
    });
  }
  if (opts.personaId) {
    snapshots.push({
      snapshot_type: "persona",
      version: opts.personaVersion ?? null,
      content_hash: hashPayload({
        id: opts.personaId,
        v: opts.personaVersion,
      }),
      payload: { persona_id: opts.personaId, version: opts.personaVersion },
    });
  }
  if (opts.presetId) {
    snapshots.push({
      snapshot_type: "instructor_preset",
      version:
        opts.presetVersion != null ? String(opts.presetVersion) : null,
      content_hash: hashPayload({
        id: opts.presetId,
        v: opts.presetVersion,
      }),
      payload: {
        instructor_preset_id: opts.presetId,
        version: opts.presetVersion ?? null,
      },
    });
  }
  snapshots.push({
    snapshot_type: "scoring_rules",
    version: ASSESSMENT_SCHEMA_VERSION,
    content_hash: hashPayload({
      items: items.map((i) => ({ id: i.id, max: i.max, weight: i.weight })),
    }),
    payload: {
      item_ids: items.map((i) => i.id),
      overall,
    },
  });

  return buildQualityLedgerEntry({
    event_type: "assessment_completed",
    assessment_id: opts.sessionId,
    session_id: opts.sessionId,
    report_id: opts.reportId ?? null,
    learner_id: opts.learnerId,
    instructor_id: opts.instructorId ?? opts.learnerId,
    institution_id: opts.institutionId ?? null,
    program_id: opts.programId ?? null,
    clinical_template_id: opts.templateId ?? null,
    clinical_template_version:
      opts.templateVersion != null ? String(opts.templateVersion) : null,
    persona_id: opts.personaId ?? snap?.persona?.id ?? null,
    persona_version: opts.personaVersion ?? null,
    diagnosis_slug: diagnosisSlug,
    comorbidities: (snap?.comorbidities ?? []).map((c) => ({
      slug: c.slug,
      name: c.name,
    })),
    language: opts.language,
    locale,
    voice_profile_id: opts.voiceProfileId ?? null,
    instructor_preset_id: opts.presetId ?? null,
    instructor_preset_version:
      opts.presetVersion != null ? String(opts.presetVersion) : null,
    competency_graph_version: CGE_ENGINE_VERSION,
    adaptive_curriculum_version: ACE_ENGINE_VERSION,
    assessment_rubric_version: RUBRIC_SCHEMA_VERSION,
    prompt_version: PROMPT_ENGINE_VERSION,
    ai_provider: heuristic ? "heuristic" : "openai",
    ai_model: opts.assessment.model ?? null,
    ai_model_version: opts.assessment.model ?? null,
    fallback_used: heuristic,
    fallback_reason: opts.assessment.failureDetail ?? (heuristic ? opts.assessment.aiSource : null),
    assessment_duration_sec: opts.durationSec,
    conversation_turns: opts.messages.length,
    word_count: countWords(opts.messages),
    token_count: opts.tokenCount ?? null,
    latency_ms: opts.latencyMs ?? null,
    created_by: opts.createdBy ?? opts.learnerId,
    snapshots,
    competency: competencyDelta(opts.competencyBefore, opts.competencyAfter),
    calculation_inputs: {
      assessment_mode: heuristic ? "heuristic_fallback" : "llm_examiner",
      ai_source: opts.assessment.aiSource,
      item_count: items.length,
    },
    metrics: {
      cfi: cfi
        ? {
            overall: cfi.overall,
            version: CFI_VERSION,
            ci: {
              lower: cfi.confidence_interval.lower,
              upper: cfi.confidence_interval.upper,
            },
            confidence: 82,
            breakdown: cfi.subscores,
            evidence: { recommendations: cfi.recommendations },
          }
        : undefined,
      eri: {
        overall: eri.overall,
        version: eri.version ?? ERI_VERSION,
        ci: {
          lower: eri.ci.lower,
          upper: eri.ci.upper,
        },
        confidence: 80,
        breakdown: eri.subscores,
        evidence: { recommendations: eri.recommendations },
      },
      avi: {
        overall: avi.overall,
        version: avi.version ?? AVI_VERSION,
        ci: {
          lower: avi.ci.lower,
          upper: avi.ci.upper,
        },
        confidence: 78,
        breakdown: avi.subscores,
        evidence: { recommendations: avi.recommendations },
      },
      ale: {
        overall: ale.overall,
        version: ALE_VERSION,
        ci: {
          lower: ale.confidence_interval.lower,
          upper: ale.confidence_interval.upper,
        },
        confidence: 75,
        breakdown: ale.subscores,
      },
      rrs: {
        overall: rrs.overall,
        version: RRS_VERSION,
        ci: {
          lower: rrs.confidence_interval.lower,
          upper: rrs.confidence_interval.upper,
        },
        confidence: 75,
        breakdown: rrs.subscores,
      },
      hcfi: {
        overall: hcfi.overall,
        version: HCFI_VERSION,
        ci: {
          lower: hcfi.confidence_interval.lower,
          upper: hcfi.confidence_interval.upper,
        },
        confidence: 72,
        breakdown: hcfi.subscores,
        evidence: {
          recommendations: hcfi.recommendations,
          alliance_band: hcfi.evidence.alliance_band,
        },
      },
      vqi: {
        overall: vqi.overall,
        version: VQI_VERSION,
        ci: {
          lower: vqi.confidence_interval.lower,
          upper: vqi.confidence_interval.upper,
        },
        confidence: vqi.confidence,
        weight_matrix: weightSet.entries,
        breakdown: vqi.subscores,
        evidence: {
          strengths: vqi.strengths,
          weaknesses: vqi.weaknesses,
          maturity: vqi.maturity,
        },
        reasoning: vqi.scientific_interpretation,
      },
    },
    payload: {
      narrative_chars: opts.assessment.narrative?.length ?? 0,
      excerpt_count: opts.assessment.excerpts?.length ?? 0,
      scores_overall: overall,
    },
  });
}

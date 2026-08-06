/**
 * CVL persistence — Postgres (admin RLS) preferred; memory fallback for dry-runs.
 * Never fabricates ratings when loading an empty vault.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssessmentAccuracyRow,
  BpcRatingSubmission,
  BtcRatingSubmission,
  CflRecord,
  CvlAssignment,
  CvlStudy,
  EducationOutcomeRow,
  HcfEvaluationRow,
  LongitudinalMeasureRow,
} from "@/lib/cvl/types";
import {
  cvlInsertAssessmentAccuracy,
  cvlInsertBpc,
  cvlInsertBtc,
  cvlInsertEducation,
  cvlInsertHcf,
  cvlInsertLongitudinal,
  cvlListAssessmentAccuracy,
  cvlListAssignments,
  cvlListBpc,
  cvlListBtc,
  cvlListCfl,
  cvlListEducation,
  cvlListHcf,
  cvlListLongitudinal,
  cvlListStudies,
  cvlReplaceMemory,
  cvlUpsertCfl,
  cvlUpdateStudyStatus,
} from "@/lib/cvl/store";

export type CvlCorpus = {
  studies: CvlStudy[];
  assignments: CvlAssignment[];
  bpc: BpcRatingSubmission[];
  btc: BtcRatingSubmission[];
  education: EducationOutcomeRow[];
  longitudinal: LongitudinalMeasureRow[];
  hcf: HcfEvaluationRow[];
  cfl: CflRecord[];
  assessment_accuracy: AssessmentAccuracyRow[];
};

export type CvlPersistSource = "database" | "memory";

function mapStudy(row: Record<string, unknown>): CvlStudy {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    kind: row.kind as CvlStudy["kind"],
    title: String(row.title),
    status: row.status as CvlStudy["status"],
    protocol_version: String(row.protocol_version ?? "1.0.0"),
    irb_reference: (row.irb_reference as string) ?? null,
    arms: (row.arms as CvlStudy["arms"]) ?? [],
    target_reviewer_types:
      (row.target_reviewer_types as CvlStudy["target_reviewer_types"]) ?? [],
    disorder_slugs: (row.disorder_slugs as string[]) ?? [],
    preregistration:
      (row.preregistration as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapAssignment(row: Record<string, unknown>): CvlAssignment {
  return {
    id: String(row.id),
    study_id: String(row.study_id),
    reviewer_token: String(row.reviewer_token),
    reviewer_type: row.reviewer_type as CvlAssignment["reviewer_type"],
    arm: row.arm as CvlAssignment["arm"],
    case_ref: String(row.case_ref),
    disorder_slug: (row.disorder_slug as string) ?? null,
    modality: String(row.modality ?? "transcript"),
    block_id: (row.block_id as string) ?? null,
    created_at: String(row.created_at),
  };
}

function mapBpc(row: Record<string, unknown>): BpcRatingSubmission {
  return {
    study_id: String(row.study_id),
    assignment_id: String(row.assignment_id),
    reviewer_token: String(row.reviewer_token),
    reviewer_type: row.reviewer_type as BpcRatingSubmission["reviewer_type"],
    modality: (row.modality as BpcRatingSubmission["modality"]) ?? "transcript",
    ratings: row.ratings as BpcRatingSubmission["ratings"],
    would_teach_with_case:
      typeof row.would_teach_with_case === "boolean"
        ? row.would_teach_with_case
        : null,
    believed_arm:
      (row.believed_arm as BpcRatingSubmission["believed_arm"]) ?? null,
    confidence_pct: Number(row.confidence_pct),
    free_comments: (row.free_comments as string) ?? undefined,
    teaching_opportunities: (row.teaching_opportunities as string) ?? undefined,
    quality_concerns: (row.quality_concerns as string) ?? undefined,
    rated_at: String(row.rated_at ?? row.created_at),
  };
}

function mapBtc(row: Record<string, unknown>): BtcRatingSubmission {
  return {
    study_id: String(row.study_id),
    assignment_id: String(row.assignment_id),
    reviewer_token: String(row.reviewer_token),
    reviewer_type: row.reviewer_type as BtcRatingSubmission["reviewer_type"],
    ratings: row.ratings as BtcRatingSubmission["ratings"],
    final_diagnosis_guess: (row.final_diagnosis_guess as string) ?? undefined,
    believed_is_ai:
      typeof row.believed_is_ai === "boolean" ? row.believed_is_ai : null,
    confidence_pct: Number(row.confidence_pct),
    free_comments: (row.free_comments as string) ?? undefined,
    rated_at: String(row.rated_at ?? row.created_at),
  };
}

function mapEducation(row: Record<string, unknown>): EducationOutcomeRow {
  return {
    study_id: String(row.study_id),
    learner_token: String(row.learner_token),
    group: (row.group_name as EducationOutcomeRow["group"]) ?? "traditional",
    osce: row.osce != null ? Number(row.osce) : null,
    mse: row.mse != null ? Number(row.mse) : null,
    dsm_diagnosis: row.dsm_diagnosis != null ? Number(row.dsm_diagnosis) : null,
    icd_diagnosis: row.icd_diagnosis != null ? Number(row.icd_diagnosis) : null,
    risk_assessment:
      row.risk_assessment != null ? Number(row.risk_assessment) : null,
    empathy: row.empathy != null ? Number(row.empathy) : null,
    documentation: row.documentation != null ? Number(row.documentation) : null,
    retention: row.retention != null ? Number(row.retention) : null,
    supervisor_rating:
      row.supervisor_rating != null ? Number(row.supervisor_rating) : null,
    time_to_competency_days:
      row.time_to_competency_days != null
        ? Number(row.time_to_competency_days)
        : null,
    recorded_at: String(row.recorded_at ?? row.created_at),
  };
}

function mapLong(row: Record<string, unknown>): LongitudinalMeasureRow {
  return {
    study_id: String(row.study_id),
    case_instance_id: String(row.case_instance_id),
    session_index: Number(row.session_index),
    memory: row.memory != null ? Number(row.memory) : null,
    life_events: row.life_events != null ? Number(row.life_events) : null,
    alliance: row.alliance != null ? Number(row.alliance) : null,
    treatment_response:
      row.treatment_response != null ? Number(row.treatment_response) : null,
    trust: row.trust != null ? Number(row.trust) : null,
    disclosure: row.disclosure != null ? Number(row.disclosure) : null,
    clinical_progression:
      row.clinical_progression != null
        ? Number(row.clinical_progression)
        : null,
    recorded_at: String(row.recorded_at ?? row.created_at),
  };
}

function mapHcf(row: Record<string, unknown>): HcfEvaluationRow {
  return {
    study_id: String(row.study_id),
    case_ref: String(row.case_ref),
    disorder_slug: String(row.disorder_slug),
    locale: (row.locale as HcfEvaluationRow["locale"]) ?? "en",
    facets: row.facets as HcfEvaluationRow["facets"],
    overall: Number(row.overall),
    rater_token: String(row.rater_token),
    rated_at: String(row.rated_at ?? row.created_at),
  };
}

function mapCfl(row: Record<string, unknown>): CflRecord {
  return {
    id: String(row.id),
    case_ref: String(row.case_ref),
    disorder_slug: (row.disorder_slug as string) ?? null,
    level: row.level as CflRecord["level"],
    rationale: (row.rationale as string[]) ?? [],
    evidence_refs: (row.evidence_refs as string[]) ?? [],
    metrics: (row.metrics as CflRecord["metrics"]) ?? {},
    computed_at: String(row.computed_at ?? row.created_at),
    ledger_ref: (row.ledger_ref as string) ?? null,
    human_approved: Boolean(row.human_approved),
  };
}

function mapAssessment(
  row: Record<string, unknown>,
): AssessmentAccuracyRow {
  return {
    study_id: String(row.study_id),
    case_ref: String(row.case_ref),
    disorder_slug: String(row.disorder_slug),
    expert_scores: row.expert_scores as Record<string, number>,
    platform_scores: row.platform_scores as Record<string, number>,
    absolute_error:
      row.absolute_error != null ? Number(row.absolute_error) : null,
    correlation: row.correlation != null ? Number(row.correlation) : null,
    rater_token: String(row.rater_token),
    notes: (row.notes as string) ?? undefined,
    rated_at: String(row.rated_at ?? row.created_at),
  };
}

/** Load corpus from DB when available; otherwise memory (never invents rows). */
export async function loadCvlCorpus(
  supabase: SupabaseClient | null,
): Promise<{ corpus: CvlCorpus; source: CvlPersistSource }> {
  if (supabase) {
    try {
      const [
        studiesRes,
        assignRes,
        bpcRes,
        btcRes,
        eduRes,
        longRes,
        hcfRes,
        cflRes,
        aaRes,
      ] = await Promise.all([
        supabase.from("cvl_studies").select("*").order("created_at", {
          ascending: false,
        }),
        supabase.from("cvl_assignments").select("*"),
        supabase.from("cvl_bpc_ratings").select("*"),
        supabase.from("cvl_btc_ratings").select("*"),
        supabase.from("cvl_education_outcomes").select("*"),
        supabase.from("cvl_longitudinal_measures").select("*"),
        supabase.from("cvl_hcf_evaluations").select("*"),
        supabase.from("cvl_cfl_records").select("*"),
        supabase.from("cvl_assessment_accuracy").select("*"),
      ]);

      const tableMissing =
        studiesRes.error?.code === "42P01" ||
        studiesRes.error?.message?.includes("does not exist");

      if (!tableMissing && !studiesRes.error) {
        const corpus: CvlCorpus = {
          studies: (studiesRes.data ?? []).map((r) =>
            mapStudy(r as Record<string, unknown>),
          ),
          assignments: (assignRes.data ?? []).map((r) =>
            mapAssignment(r as Record<string, unknown>),
          ),
          bpc: (bpcRes.data ?? []).map((r) =>
            mapBpc(r as Record<string, unknown>),
          ),
          btc: (btcRes.data ?? []).map((r) =>
            mapBtc(r as Record<string, unknown>),
          ),
          education: (eduRes.data ?? []).map((r) =>
            mapEducation(r as Record<string, unknown>),
          ),
          longitudinal: (longRes.data ?? []).map((r) =>
            mapLong(r as Record<string, unknown>),
          ),
          hcf: (hcfRes.data ?? []).map((r) =>
            mapHcf(r as Record<string, unknown>),
          ),
          cfl: (cflRes.data ?? []).map((r) =>
            mapCfl(r as Record<string, unknown>),
          ),
          assessment_accuracy: (aaRes.data ?? []).map((r) =>
            mapAssessment(r as Record<string, unknown>),
          ),
        };
        cvlReplaceMemory(corpus);
        return { corpus, source: "database" };
      }
    } catch (e) {
      console.warn(
        "[cvl] DB load failed:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  return {
    corpus: {
      studies: cvlListStudies(),
      assignments: cvlListAssignments(),
      bpc: cvlListBpc(),
      btc: cvlListBtc(),
      education: cvlListEducation(),
      longitudinal: cvlListLongitudinal(),
      hcf: cvlListHcf(),
      cfl: cvlListCfl(),
      assessment_accuracy: cvlListAssessmentAccuracy(),
    },
    source: "memory",
  };
}

export async function persistStudyBundle(
  supabase: SupabaseClient | null,
  study: CvlStudy,
  assignments: CvlAssignment[],
  createdBy?: string | null,
): Promise<CvlPersistSource> {
  if (!supabase) return "memory";
  const { error: sErr } = await supabase.from("cvl_studies").upsert({
    id: study.id,
    created_at: study.created_at,
    updated_at: study.updated_at,
    kind: study.kind,
    title: study.title,
    status: study.status,
    protocol_version: study.protocol_version,
    irb_reference: study.irb_reference,
    arms: study.arms,
    target_reviewer_types: study.target_reviewer_types,
    disorder_slugs: study.disorder_slugs,
    preregistration: study.preregistration,
    metadata: study.metadata,
    created_by: createdBy ?? null,
  });
  if (sErr) {
    console.warn("[cvl] study upsert failed:", sErr.message);
    return "memory";
  }
  if (assignments.length) {
    const { error: aErr } = await supabase.from("cvl_assignments").upsert(
      assignments.map((a) => ({
        id: a.id,
        created_at: a.created_at,
        study_id: a.study_id,
        reviewer_token: a.reviewer_token,
        reviewer_type: a.reviewer_type,
        arm: a.arm,
        case_ref: a.case_ref,
        disorder_slug: a.disorder_slug,
        modality: a.modality,
        block_id: a.block_id,
      })),
    );
    if (aErr) {
      console.warn("[cvl] assignment upsert failed:", aErr.message);
      return "memory";
    }
  }
  return "database";
}

export async function persistBpc(
  supabase: SupabaseClient | null,
  row: BpcRatingSubmission,
): Promise<CvlPersistSource> {
  cvlInsertBpc(row);
  if (!supabase) return "memory";
  const { error } = await supabase.from("cvl_bpc_ratings").insert({
    study_id: row.study_id,
    assignment_id: row.assignment_id,
    reviewer_token: row.reviewer_token,
    reviewer_type: row.reviewer_type,
    modality: row.modality,
    ratings: row.ratings,
    would_teach_with_case: row.would_teach_with_case,
    believed_arm: row.believed_arm,
    confidence_pct: row.confidence_pct,
    free_comments: row.free_comments ?? null,
    teaching_opportunities: row.teaching_opportunities ?? null,
    quality_concerns: row.quality_concerns ?? null,
    rated_at: row.rated_at,
  });
  if (error) {
    console.warn("[cvl] bpc insert failed:", error.message);
    return "memory";
  }
  return "database";
}

export async function persistBtc(
  supabase: SupabaseClient | null,
  row: BtcRatingSubmission,
): Promise<CvlPersistSource> {
  cvlInsertBtc(row);
  if (!supabase) return "memory";
  const { error } = await supabase.from("cvl_btc_ratings").insert({
    study_id: row.study_id,
    assignment_id: row.assignment_id,
    reviewer_token: row.reviewer_token,
    reviewer_type: row.reviewer_type,
    ratings: row.ratings,
    final_diagnosis_guess: row.final_diagnosis_guess ?? null,
    believed_is_ai: row.believed_is_ai,
    confidence_pct: row.confidence_pct,
    free_comments: row.free_comments ?? null,
    rated_at: row.rated_at,
  });
  if (error) {
    console.warn("[cvl] btc insert failed:", error.message);
    return "memory";
  }
  return "database";
}

export async function persistHcf(
  supabase: SupabaseClient | null,
  row: HcfEvaluationRow,
): Promise<CvlPersistSource> {
  cvlInsertHcf(row);
  if (!supabase) return "memory";
  const { error } = await supabase.from("cvl_hcf_evaluations").insert({
    study_id: row.study_id,
    case_ref: row.case_ref,
    disorder_slug: row.disorder_slug,
    locale: row.locale,
    facets: row.facets,
    overall: row.overall,
    rater_token: row.rater_token,
    rated_at: row.rated_at,
  });
  if (error) {
    console.warn("[cvl] hcf insert failed:", error.message);
    return "memory";
  }
  return "database";
}

export async function persistEducation(
  supabase: SupabaseClient | null,
  row: EducationOutcomeRow,
): Promise<CvlPersistSource> {
  cvlInsertEducation(row);
  if (!supabase) return "memory";
  const { error } = await supabase.from("cvl_education_outcomes").insert({
    study_id: row.study_id,
    learner_token: row.learner_token,
    group_name: row.group,
    osce: row.osce,
    mse: row.mse,
    dsm_diagnosis: row.dsm_diagnosis,
    icd_diagnosis: row.icd_diagnosis,
    risk_assessment: row.risk_assessment,
    empathy: row.empathy,
    documentation: row.documentation,
    retention: row.retention,
    supervisor_rating: row.supervisor_rating,
    time_to_competency_days: row.time_to_competency_days,
    recorded_at: row.recorded_at,
  });
  if (error) {
    console.warn("[cvl] education insert failed:", error.message);
    return "memory";
  }
  return "database";
}

export async function persistLongitudinal(
  supabase: SupabaseClient | null,
  row: LongitudinalMeasureRow,
): Promise<CvlPersistSource> {
  cvlInsertLongitudinal(row);
  if (!supabase) return "memory";
  const { error } = await supabase.from("cvl_longitudinal_measures").insert({
    study_id: row.study_id,
    case_instance_id: row.case_instance_id,
    session_index: row.session_index,
    memory: row.memory,
    life_events: row.life_events,
    alliance: row.alliance,
    treatment_response: row.treatment_response,
    trust: row.trust,
    disclosure: row.disclosure,
    clinical_progression: row.clinical_progression,
    recorded_at: row.recorded_at,
  });
  if (error) {
    console.warn("[cvl] longitudinal insert failed:", error.message);
    return "memory";
  }
  return "database";
}

export async function persistCfl(
  supabase: SupabaseClient | null,
  row: CflRecord,
): Promise<{ record: CflRecord; source: CvlPersistSource }> {
  const saved = cvlUpsertCfl(row);
  if (!supabase) return { record: saved, source: "memory" };
  const { data, error } = await supabase
    .from("cvl_cfl_records")
    .upsert(
      {
        id: saved.id,
        case_ref: saved.case_ref,
        disorder_slug: saved.disorder_slug,
        level: saved.level,
        rationale: saved.rationale,
        evidence_refs: saved.evidence_refs,
        metrics: saved.metrics,
        computed_at: saved.computed_at,
        ledger_ref: saved.ledger_ref,
        human_approved: saved.human_approved,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "case_ref" },
    )
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[cvl] cfl upsert failed:", error.message);
    return { record: saved, source: "memory" };
  }
  return {
    record: data ? mapCfl(data as Record<string, unknown>) : saved,
    source: "database",
  };
}

export async function persistAssessmentAccuracy(
  supabase: SupabaseClient | null,
  row: AssessmentAccuracyRow,
): Promise<CvlPersistSource> {
  cvlInsertAssessmentAccuracy(row);
  if (!supabase) return "memory";
  const { error } = await supabase.from("cvl_assessment_accuracy").insert({
    study_id: row.study_id,
    case_ref: row.case_ref,
    disorder_slug: row.disorder_slug,
    expert_scores: row.expert_scores,
    platform_scores: row.platform_scores,
    absolute_error: row.absolute_error,
    correlation: row.correlation,
    rater_token: row.rater_token,
    notes: row.notes ?? null,
    rated_at: row.rated_at,
  });
  if (error) {
    console.warn("[cvl] assessment accuracy insert failed:", error.message);
    return "memory";
  }
  return "database";
}

export async function persistStudyStatus(
  supabase: SupabaseClient | null,
  studyId: string,
  status: CvlStudy["status"],
): Promise<CvlStudy | null> {
  const mem = cvlUpdateStudyStatus(studyId, status);
  if (!supabase) return mem;
  const { data, error } = await supabase
    .from("cvl_studies")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", studyId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.warn("[cvl] status update failed:", error.message);
    return mem;
  }
  return data ? mapStudy(data as Record<string, unknown>) : mem;
}


/**
 * Validation Engine — orchestrates Stage 8 observational pipelines.
 *
 * Validation observes only.
 * Validation never owns patient state.
 * Validation never changes cognition.
 * Validation never modifies memory.
 */

import { buildAuditReports } from "@/lib/validation/audit";
import { compareAgainstBenchmarks } from "@/lib/validation/clinical-benchmark";
import { scoreConsistency } from "@/lib/validation/consistency";
import { evaluateLongitudinal } from "@/lib/validation/longitudinal";
import { buildQualityMetrics } from "@/lib/validation/metrics";
import { evaluatePsychometrics } from "@/lib/validation/psychometric-engine";
import { scoreRealism } from "@/lib/validation/realism";
import { scoreReliability } from "@/lib/validation/reliability";
import { validateScenarioDsm } from "@/lib/validation/scenario-validator";
import { stableId } from "@/lib/validation/helpers";
import { storeValidationRun } from "@/lib/validation/store";
import {
  VALIDATION_OWNERSHIP_RULE,
  buildValidationVersionLock,
} from "@/lib/validation/versions";
import type {
  ExpertRating,
  SessionObservables,
  ValidationDashboardSnapshot,
  ValidationRunResult,
} from "@/lib/validation/types";
import { mean } from "@/lib/validation/helpers";
import { listExpertRatings, listValidationRuns } from "@/lib/validation/store";

export { VALIDATION_OWNERSHIP_RULE };

export function runValidationPipeline(input: {
  session: SessionObservables;
  sessionsForPsychometrics?: SessionObservables[];
  ratings?: ExpertRating[];
  studyId?: string | null;
  seed?: string;
  persist?: boolean;
}): ValidationRunResult {
  const realism = scoreRealism(input.session);
  const dsm = validateScenarioDsm(input.session);
  const consistency = scoreConsistency(input.session);
  const cohort = input.sessionsForPsychometrics?.length
    ? input.sessionsForPsychometrics
    : [input.session];
  const ratings = input.ratings ?? [];
  const reliability = scoreReliability({ sessions: cohort, ratings });
  const psychometrics = evaluatePsychometrics(cohort);
  const metrics = buildQualityMetrics({
    realismOverall: realism.overall,
    consistencyOverall: consistency.overall,
    dsmOverall: dsm.overall,
    realismDimensions: realism.dimensions,
    sessions: cohort,
  });
  const benchmarks = compareAgainstBenchmarks({
    metrics,
    sessions: cohort,
  });
  const longitudinal = evaluateLongitudinal({
    sessions: cohort,
    seed: input.seed ?? input.session.clinical.session_id,
  });
  const audits = buildAuditReports({
    session: input.session,
    realism,
    dsm,
    consistency,
    metrics,
  });

  const run: ValidationRunResult = {
    id: stableId(
      "val",
      `${input.session.clinical.session_id}:${input.seed ?? "run"}`,
    ),
    session_id: input.session.clinical.session_id,
    study_id: input.studyId ?? null,
    created_at: new Date().toISOString(),
    realism,
    dsm,
    consistency,
    reliability,
    psychometrics,
    metrics,
    benchmarks,
    longitudinal,
    audits,
    versions: buildValidationVersionLock(),
    observational: true,
    patient_state_modified: false,
  };

  if (input.persist !== false) {
    storeValidationRun(run);
  }

  return run;
}

export function buildValidationDashboard(
  runs?: ValidationRunResult[],
  ratings?: ExpertRating[],
): ValidationDashboardSnapshot {
  const rs = runs ?? listValidationRuns();
  const rts = ratings ?? listExpertRatings();

  const domainSummary: Record<string, { n: number; mean: number }> = {};
  for (const r of rts) {
    const cur = domainSummary[r.domain] ?? { n: 0, mean: 0 };
    const n = cur.n + 1;
    domainSummary[r.domain] = {
      n,
      mean: (cur.mean * cur.n + r.score) / n,
    };
  }

  const metricKeys = [
    "realism_index",
    "consistency_index",
    "clinical_fidelity",
    "memory_integrity",
    "diagnostic_stability",
    "conversation_quality",
    "alliance_score",
    "behaviour_stability",
    "decision_stability",
    "session_quality",
  ] as const;

  const quality_metrics_means: ValidationDashboardSnapshot["quality_metrics_means"] =
    {};
  for (const k of metricKeys) {
    const xs = rs.map((r) => r.metrics[k]);
    if (xs.length) quality_metrics_means[k] = Math.round(mean(xs) * 10) / 10;
  }

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    n_runs: rs.length,
    n_ratings: rts.length,
    trend: rs
      .slice()
      .reverse()
      .map((r) => ({
        at: r.created_at,
        realism_index: r.metrics.realism_index,
        consistency_index: r.metrics.consistency_index,
      })),
    confidence_intervals: rs.slice(0, 20).map((r) => ({
      metric: `realism:${r.id}`,
      ci: r.realism.confidence_interval,
    })),
    reliability_plots: rs.flatMap((r) => r.reliability.inter_rater).slice(0, 40),
    validation_history: rs.map((r) => ({
      id: r.id,
      session_id: r.session_id,
      overall_realism: r.realism.overall,
      created_at: r.created_at,
    })),
    benchmark_comparisons: rs.flatMap((r) => r.benchmarks).slice(0, 60),
    expert_ratings_summary: { n: rts.length, domains: domainSummary },
    quality_metrics_means,
    limitations: [
      "Dashboard aggregates observational fidelity metrics only",
      "Competency scores remain unvalidated",
      "Empty corpora fall back to offline simulations marked as such in longitudinal results",
    ],
  };
}

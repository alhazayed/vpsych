import type {
  BpcRatingSubmission,
  CvlAssignment,
  CvlMetricResult,
  EducationOutcomeRow,
  HcfEvaluationRow,
  LongitudinalMeasureRow,
} from "@/lib/cvl/types";
import { CVL_VERSION } from "@/lib/cvl/types";
import { scoreBpcComposite } from "@/lib/cvl/bpc";
import { ci95Mean, clamp01to100, mean } from "@/lib/cvl/statistics";

const ALGO = "cvl-metrics-1.0.0";

function metric(
  id: CvlMetricResult["metric_id"],
  scores: number[],
  refs: string[],
  minN = 3,
): CvlMetricResult {
  const m = mean(scores);
  const insufficient = scores.length < minN || m == null;
  return {
    metric_id: id,
    score: insufficient ? null : clamp01to100(m!),
    n: scores.length,
    ci95: insufficient ? null : ci95Mean(scores),
    insufficient_data: insufficient,
    evidence_refs: refs,
    computed_at: new Date().toISOString(),
    algorithm_version: ALGO,
  };
}

/** Clinical Realism Index from BPC clinical/emotional/diagnostic facets. */
export function computeCRI(
  bpc: BpcRatingSubmission[],
  assignments: CvlAssignment[],
): CvlMetricResult {
  const armById = new Map(assignments.map((a) => [a.id, a.arm]));
  const scores = bpc
    .filter((r) => armById.get(r.assignment_id) === "vpsych_avatar")
    .map((r) => {
      const a = r.ratings.clinical_realism;
      const b = r.ratings.emotional_realism;
      const c = r.ratings.diagnostic_consistency;
      return ((a + b + c) / 3 - 1) * 25;
    });
  return metric(
    "CRI",
    scores,
    bpc.map((r) => `bpc:${r.assignment_id}`),
  );
}

export function computeHCFI(rows: HcfEvaluationRow[]): CvlMetricResult {
  return metric(
    "HCFI",
    rows.map((r) => r.overall),
    rows.map((r) => `hcf:${r.case_ref}`),
  );
}

export function computeTAI(bpc: BpcRatingSubmission[]): CvlMetricResult {
  const scores = bpc.map(
    (r) =>
      ((r.ratings.therapeutic_alliance + r.ratings.rapport) / 2 - 1) * 25,
  );
  return metric(
    "TAI",
    scores,
    bpc.map((r) => `bpc:${r.assignment_id}:alliance`),
  );
}

export function computePCI(bpc: BpcRatingSubmission[]): CvlMetricResult {
  const scores = bpc.map(
    (r) =>
      ((r.ratings.diagnostic_consistency + r.ratings.thought_process) / 2 -
        1) *
      25,
  );
  return metric(
    "PCI",
    scores,
    bpc.map((r) => `bpc:${r.assignment_id}:consistency`),
  );
}

export function computeEEI(
  bpc: BpcRatingSubmission[],
  edu: EducationOutcomeRow[],
): CvlMetricResult {
  const teachScores = bpc
    .filter((r) => r.would_teach_with_case === true)
    .map((r) => ((r.ratings.educational_usefulness - 1) / 4) * 100);
  const eduScores = edu
    .filter((r) => r.group === "vpsych")
    .map((r) => {
      const xs = [
        r.osce,
        r.mse,
        r.dsm_diagnosis,
        r.icd_diagnosis,
        r.empathy,
        r.supervisor_rating,
      ].filter((x): x is number => typeof x === "number");
      return mean(xs);
    })
    .filter((x): x is number => x != null);
  return metric(
    "EEI",
    [...teachScores, ...eduScores],
    [
      ...bpc.map((r) => `bpc:${r.assignment_id}:edu`),
      ...edu.map((r) => `edu:${r.learner_token}`),
    ],
  );
}

export function computeDFI(bpc: BpcRatingSubmission[]): CvlMetricResult {
  const scores = bpc.map(
    (r) => ((r.ratings.diagnostic_consistency - 1) / 4) * 100,
  );
  return metric(
    "DFI",
    scores,
    bpc.map((r) => `bpc:${r.assignment_id}:dfi`),
  );
}

export function computeLCI(rows: LongitudinalMeasureRow[]): CvlMetricResult {
  // Prefer later sessions (6–10) mean progression facets
  const late = rows.filter((r) => r.session_index >= 6);
  const scores = (late.length ? late : rows).map((r) => {
    const xs = [
      r.memory,
      r.alliance,
      r.trust,
      r.disclosure,
      r.clinical_progression,
    ].filter((x): x is number => typeof x === "number");
    return mean(xs) ?? 0;
  });
  return metric(
    "LCI",
    scores,
    rows.map((r) => `long:${r.case_instance_id}:s${r.session_index}`),
    2,
  );
}

export function computeAllMetrics(input: {
  bpc: BpcRatingSubmission[];
  assignments: CvlAssignment[];
  hcf: HcfEvaluationRow[];
  education: EducationOutcomeRow[];
  longitudinal: LongitudinalMeasureRow[];
}): CvlMetricResult[] {
  return [
    computeCRI(input.bpc, input.assignments),
    computeHCFI(input.hcf),
    computeTAI(input.bpc),
    computePCI(input.bpc),
    computeEEI(input.bpc, input.education),
    computeDFI(input.bpc),
    computeLCI(input.longitudinal),
  ];
}

export function bpcComposites(
  bpc: BpcRatingSubmission[],
): Array<{ assignment_id: string; composite: number }> {
  return bpc.map((r) => ({
    assignment_id: r.assignment_id,
    composite: scoreBpcComposite(r.ratings),
  }));
}

export { CVL_VERSION };

import type {
  BpcRatingSubmission,
  CflRecord,
  CvlAssignment,
  CvlDashboard,
  CvlStudy,
  EducationOutcomeRow,
  HcfEvaluationRow,
  LongitudinalMeasureRow,
} from "@/lib/cvl/types";
import { CLINICAL_FIDELITY_LEVELS, CVL_VERSION } from "@/lib/cvl/types";
import { computeAllMetrics } from "@/lib/cvl/metrics";
import { buildValidationRoadmap } from "@/lib/cvl/roadmap";
import { icc2Approx, mean } from "@/lib/cvl/statistics";
import { scoreBpcComposite } from "@/lib/cvl/bpc";

export function buildCvlDashboard(input: {
  studies: CvlStudy[];
  assignments: CvlAssignment[];
  bpc: BpcRatingSubmission[];
  hcf: HcfEvaluationRow[];
  education: EducationOutcomeRow[];
  longitudinal: LongitudinalMeasureRow[];
  cfl: CflRecord[];
}): CvlDashboard {
  const metrics = computeAllMetrics({
    bpc: input.bpc,
    assignments: input.assignments,
    hcf: input.hcf,
    education: input.education,
    longitudinal: input.longitudinal,
  });

  const studies = input.studies.map((s) => ({
    id: s.id,
    title: s.title,
    kind: s.kind,
    status: s.status,
    n_assignments: input.assignments.filter((a) => a.study_id === s.id).length,
    n_ratings:
      input.bpc.filter((r) => r.study_id === s.id).length +
      input.hcf.filter((r) => r.study_id === s.id).length,
  }));

  const cfl_distribution = CLINICAL_FIDELITY_LEVELS.map((level) => ({
    level,
    n: input.cfl.filter((c) => c.level === level).length,
  }));

  const byDisorderMap = new Map<
    string,
    { cri: number[]; hcfi: number[]; cfl: CflRecord[]; n: number }
  >();
  for (const a of input.assignments) {
    const d = a.disorder_slug ?? "unknown";
    const bucket = byDisorderMap.get(d) ?? { cri: [], hcfi: [], cfl: [], n: 0 };
    bucket.n += 1;
    byDisorderMap.set(d, bucket);
  }
  for (const r of input.bpc) {
    const a = input.assignments.find((x) => x.id === r.assignment_id);
    const d = a?.disorder_slug ?? "unknown";
    const bucket = byDisorderMap.get(d) ?? { cri: [], hcfi: [], cfl: [], n: 0 };
    bucket.cri.push(
      ((r.ratings.clinical_realism +
        r.ratings.emotional_realism +
        r.ratings.diagnostic_consistency) /
        3 -
        1) *
        25,
    );
    byDisorderMap.set(d, bucket);
  }
  for (const h of input.hcf) {
    const bucket =
      byDisorderMap.get(h.disorder_slug) ?? {
        cri: [],
        hcfi: [],
        cfl: [],
        n: 0,
      };
    bucket.hcfi.push(h.overall);
    byDisorderMap.set(h.disorder_slug, bucket);
  }
  for (const c of input.cfl) {
    const d = c.disorder_slug ?? "unknown";
    const bucket = byDisorderMap.get(d) ?? { cri: [], hcfi: [], cfl: [], n: 0 };
    bucket.cfl.push(c);
    byDisorderMap.set(d, bucket);
  }

  const by_disorder = [...byDisorderMap.entries()].map(([disorder, b]) => ({
    disorder,
    cri: mean(b.cri),
    hcfi: mean(b.hcfi),
    cfl: b.cfl[0]?.level ?? null,
    n: b.n,
  }));

  // ICC matrix
  const byCase = new Map<string, number[]>();
  for (const r of input.bpc) {
    const a = input.assignments.find((x) => x.id === r.assignment_id);
    const key = a?.case_ref ?? r.assignment_id;
    const list = byCase.get(key) ?? [];
    list.push(scoreBpcComposite(r.ratings));
    byCase.set(key, list);
  }
  const matrix = [...byCase.values()].filter((row) => row.length >= 2);
  const minK = matrix.length ? Math.min(...matrix.map((r) => r.length)) : 0;
  const square = minK >= 2 ? matrix.map((r) => r.slice(0, minK)) : [];
  const icc = square.length >= 2 ? icc2Approx(square) : null;

  const notes = [
    input.bpc.length + input.hcf.length === 0
      ? "CVL vault empty — register a study and collect blinded human ratings. No fabricated evidence."
      : `Loaded ${input.bpc.length} BPC and ${input.hcf.length} HCF human rating(s).`,
    "Reviewer tokens are opaque; identities never appear on this dashboard.",
    "CFL advancement requires human approval before research claims.",
  ];

  return {
    cvl_version: CVL_VERSION,
    generated_at: new Date().toISOString(),
    studies,
    metrics,
    cfl_distribution,
    by_disorder,
    reviewer_agreement: {
      icc,
      n_raters: new Set(input.bpc.map((r) => r.reviewer_token)).size,
      n_items: byCase.size,
      insufficient_data: icc == null,
    },
    roadmap: buildValidationRoadmap(metrics),
    notes,
  };
}

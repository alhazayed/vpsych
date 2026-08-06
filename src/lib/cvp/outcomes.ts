import { mean } from "@/lib/scientific/psychometrics";
import type { EducationalOutcomeSummary, OutcomeTimepoint } from "./types";

export type OutcomeRow = {
  enrollment_id: string;
  timepoint: OutcomeTimepoint;
  instrument_slug: string;
  scores: Record<string, unknown>;
};

function overallFromScores(scores: Record<string, unknown>): number | null {
  if (typeof scores.overall === "number") return scores.overall;
  const nums = Object.values(scores).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  return nums.length ? mean(nums) : null;
}

export function summarizeEducationalOutcomes(
  rows: OutcomeRow[],
): EducationalOutcomeSummary[] {
  const byInstrument = new Map<string, OutcomeRow[]>();
  for (const r of rows) {
    const list = byInstrument.get(r.instrument_slug) ?? [];
    list.push(r);
    byInstrument.set(r.instrument_slug, list);
  }

  const out: EducationalOutcomeSummary[] = [];
  for (const [instrument, list] of byInstrument) {
    const baseline = list.filter((r) => r.timepoint === "baseline");
    const post = list.filter((r) => r.timepoint === "post");
    const followup = list.filter((r) => r.timepoint === "followup");
    const bVals = baseline
      .map((r) => overallFromScores(r.scores))
      .filter((v): v is number => v != null);
    const pVals = post
      .map((r) => overallFromScores(r.scores))
      .filter((v): v is number => v != null);

    const byEnrollment = new Map<string, { b?: number; p?: number }>();
    for (const r of baseline) {
      const v = overallFromScores(r.scores);
      if (v == null) continue;
      const cur = byEnrollment.get(r.enrollment_id) ?? {};
      cur.b = v;
      byEnrollment.set(r.enrollment_id, cur);
    }
    for (const r of post) {
      const v = overallFromScores(r.scores);
      if (v == null) continue;
      const cur = byEnrollment.get(r.enrollment_id) ?? {};
      cur.p = v;
      byEnrollment.set(r.enrollment_id, cur);
    }
    const paired = [...byEnrollment.values()].filter(
      (x) => x.b != null && x.p != null,
    );
    const changes = paired.map((x) => x.p! - x.b!);

    out.push({
      instrument_slug: instrument,
      baseline_n: baseline.length,
      post_n: post.length,
      followup_n: followup.length,
      baseline_mean: bVals.length ? Math.round(mean(bVals) * 100) / 100 : null,
      post_mean: pVals.length ? Math.round(mean(pVals) * 100) / 100 : null,
      mean_change: changes.length
        ? Math.round(mean(changes) * 100) / 100
        : null,
      paired_n: paired.length,
    });
  }
  return out;
}

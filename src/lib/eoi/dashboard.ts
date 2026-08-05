import { EOI_VERSION, type EoiDashboard, type EoiOpportunityRow } from "@/lib/eoi/types";
import type { EoiClusterDraft } from "@/lib/eoi/types";

function countBy(
  rows: EoiOpportunityRow[],
  fn: (r: EoiOpportunityRow) => string | null | undefined,
): Array<{ key: string; n: number }> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = fn(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n);
}

export function buildEoiDashboard(
  rows: EoiOpportunityRow[],
  clusters: EoiClusterDraft[],
): EoiDashboard {
  const backlog = clusters
    .slice()
    .sort((a, b) => b.backlog_score - a.backlog_score);

  const byComp = new Map<string, number>();
  for (const r of rows) {
    for (const c of r.competencies) byComp.set(c, (byComp.get(c) ?? 0) + 1);
  }
  const byLearner = new Map<string, number>();
  for (const r of rows) {
    for (const l of r.target_learners)
      byLearner.set(l, (byLearner.get(l) ?? 0) + 1);
  }

  return {
    eoi_version: EOI_VERSION,
    generated_at: new Date().toISOString(),
    totals: {
      opportunities: rows.length,
      clusters: clusters.length,
      high_impact: rows.filter((r) => r.educational_impact >= 4).length,
      accepted: rows.filter((r) =>
        ["accepted", "scheduled", "implemented", "validated", "published"].includes(
          r.status,
        ),
      ).length,
    },
    top_opportunities: backlog.slice(0, 15).map((c) => ({
      title: c.title,
      report_count: c.report_count,
      educational_impact_avg: c.educational_impact_avg,
      educational_priority: c.educational_priority,
      backlog_score: c.backlog_score,
    })),
    by_type: countBy(rows, (r) => r.opportunity_type).map((x) => ({
      type: x.key,
      n: x.n,
    })),
    by_competency: [...byComp.entries()]
      .map(([competency, n]) => ({ competency, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 20),
    by_learner: [...byLearner.entries()]
      .map(([learner, n]) => ({ learner, n }))
      .sort((a, b) => b.n - a.n),
    by_disorder: countBy(rows, (r) => r.disorder_slug).map((x) => ({
      disorder: x.key,
      n: x.n,
    })),
    backlog: backlog.slice(0, 25).map((c) => ({
      title: c.title,
      backlog_score: c.backlog_score,
      educational_priority: c.educational_priority,
      effort_estimate: c.effort_estimate,
      research_value: c.research_value,
    })),
    trends: {
      by_release: countBy(rows, (r) => r.release_version).map((x) => ({
        release: x.key,
        n: x.n,
      })),
    },
  };
}

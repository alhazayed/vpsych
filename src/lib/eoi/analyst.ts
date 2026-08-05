/**
 * AI Educational Analyst — "How could this improve learning?"
 * Never frames opportunities as defects.
 */

import { clusterOpportunities } from "@/lib/eoi/cluster";
import type { EoiClusterDraft, EoiOpportunityRow } from "@/lib/eoi/types";

export type EoiAnalystReport = {
  analyzed_at: string;
  opportunity_count: number;
  cluster_count: number;
  clusters: EoiClusterDraft[];
  backlog: EoiClusterDraft[];
  notes: string[];
  research_questions: string[];
};

export function runEducationalAnalyst(
  rows: EoiOpportunityRow[],
): EoiAnalystReport {
  const clusters = clusterOpportunities(rows);
  const backlog = clusters
    .slice()
    .sort((a, b) => b.backlog_score - a.backlog_score);

  const notes = [
    rows.length
      ? `Analyzed ${rows.length} educational opportunity asset(s) into ${clusters.length} curriculum cluster(s).`
      : "EOI vault empty — no educational opportunities captured yet.",
    "These are teaching innovations, not bug reports. Do not route into defect remediation.",
    "Curriculum recommendations require human educator approval before implementation.",
  ];

  const research_questions = [
    "Which educational enhancements produce the greatest improvement in learner performance?",
    "Which disorders generate the most teaching opportunities?",
    "Which competencies require additional instructional support?",
    rows.length
      ? `Top requested competency signals: ${summarizeCompetencies(rows)}`
      : "Awaiting competency-linked opportunities for research stratification.",
  ];

  return {
    analyzed_at: new Date().toISOString(),
    opportunity_count: rows.length,
    cluster_count: clusters.length,
    clusters,
    backlog,
    notes,
    research_questions,
  };
}

function summarizeCompetencies(rows: EoiOpportunityRow[]): string {
  const m = new Map<string, number>();
  for (const r of rows) {
    for (const c of r.competencies) m.set(c, (m.get(c) ?? 0) + 1);
  }
  return (
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, n]) => `${c}(${n})`)
      .join(", ") || "none yet"
  );
}

import type { EoiClusterDraft, EoiOpportunityRow } from "@/lib/eoi/types";
import { EOI_VERSION } from "@/lib/eoi/types";
import { runEducationalAnalyst } from "@/lib/eoi/analyst";

export function opportunitiesToCsv(
  rows: EoiOpportunityRow[],
  redact: boolean,
): string {
  const header = [
    "id",
    "created_at",
    "opportunity_type",
    "educational_impact",
    "status",
    "disorder_slug",
    "language",
    "target_learners",
    "competencies",
    "idea_text",
    "release_version",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const idea = redact
      ? `[redacted ${r.idea_text.length} chars]`
      : r.idea_text.replace(/"/g, '""');
    lines.push(
      [
        r.id,
        r.created_at,
        r.opportunity_type,
        String(r.educational_impact),
        r.status,
        r.disorder_slug ?? "",
        r.language ?? "",
        r.target_learners.join("|"),
        r.competencies.join("|"),
        `"${idea}"`,
        r.release_version ?? "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function buildEoiResearchPackage(
  rows: EoiOpportunityRow[],
  clusters?: EoiClusterDraft[],
) {
  const analyst = runEducationalAnalyst(rows);
  return {
    eoi_version: EOI_VERSION,
    generated_at: new Date().toISOString(),
    is_defect: false as const,
    kind: "educational_opportunity" as const,
    opportunity_count: rows.length,
    cluster_count: (clusters ?? analyst.clusters).length,
    analyst_notes: analyst.notes,
    research_questions: analyst.research_questions,
    backlog: analyst.backlog.slice(0, 50).map((c) => ({
      title: c.title,
      backlog_score: c.backlog_score,
      educational_priority: c.educational_priority,
      expected_benefit: c.expected_benefit,
      report_count: c.report_count,
      competencies: c.competencies,
      target_learners: c.target_learners,
      research_value: c.research_value,
      is_defect: false as const,
    })),
    by_disorder: summarize(rows.map((r) => r.disorder_slug)),
    by_competency: summarize(rows.flatMap((r) => r.competencies)),
  };
}

function summarize(keys: Array<string | null | undefined>) {
  const m = new Map<string, number>();
  for (const k of keys) {
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n);
}

import { tokenizeIssue } from "@/lib/cqi/fingerprint";
import {
  buildEoiRecommendation,
  computeBacklogScore,
} from "@/lib/eoi/recommendation";
import type {
  EoiClusterDraft,
  EoiOpportunityRow,
  EoiOpportunityType,
} from "@/lib/eoi/types";

function uniq(xs: Array<string | null | undefined>): string[] {
  return [...new Set(xs.filter((x): x is string => Boolean(x && String(x).trim())))];
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export function clusterOpportunities(
  rows: EoiOpportunityRow[],
): EoiClusterDraft[] {
  if (!rows.length) return [];

  const byFp = new Map<string, EoiOpportunityRow[]>();
  for (const r of rows) {
    const key = r.fingerprint || `${r.opportunity_type}:${r.id}`;
    const list = byFp.get(key) ?? [];
    list.push(r);
    byFp.set(key, list);
  }

  const groups = [...byFp.values()];
  const merged: EoiOpportunityRow[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < groups.length; i++) {
    if (used.has(i)) continue;
    let bucket = [...groups[i]!];
    const tokensI = tokenizeIssue(bucket.map((x) => x.idea_text).join(" "));
    for (let j = i + 1; j < groups.length; j++) {
      if (used.has(j)) continue;
      const other = groups[j]!;
      if (other[0]?.opportunity_type !== bucket[0]?.opportunity_type) continue;
      const tokensJ = tokenizeIssue(other.map((x) => x.idea_text).join(" "));
      if (jaccard(tokensI, tokensJ) >= 0.4) {
        bucket = bucket.concat(other);
        used.add(j);
      }
    }
    used.add(i);
    merged.push(bucket);
  }

  return merged.map(draftFromMembers);
}

function draftFromMembers(members: EoiOpportunityRow[]): EoiClusterDraft {
  const n = members.length;
  const type = (members[0]?.opportunity_type ??
    "other") as EoiOpportunityType;
  const impact_avg =
    members.reduce((a, m) => a + m.educational_impact, 0) / n;
  const titleSeed = tokenizeIssue(members[0]?.idea_text ?? type)
    .slice(0, 6)
    .join(" ");
  const title =
    n > 1
      ? `${type.replace(/_/g, " ")}: ${titleSeed} (${n})`
      : `${type.replace(/_/g, " ")}: ${titleSeed || "opportunity"}`;

  const learners = uniq(members.flatMap((m) => m.target_learners));
  const competencies = uniq(members.flatMap((m) => m.competencies));
  const disorders = uniq(members.map((m) => m.disorder_slug));
  const languages = uniq(members.map((m) => m.language));

  const recommendation = buildEoiRecommendation({
    title,
    opportunity_type: type,
    impact_avg,
    report_count: n,
    idea_samples: members.map((m) => m.idea_text).slice(0, 5),
    disorders,
    learners,
    competencies,
    languages,
  });

  const backlog_score = computeBacklogScore({
    impact_avg,
    report_count: n,
    priority: recommendation.educational_priority,
    effort: recommendation.estimated_effort,
    research_high: /High/i.test(recommendation.research_value),
  });

  const definiteShare = members.filter((m) => m.educational_impact >= 4).length / n;

  return {
    title,
    summary: `Educational opportunity cluster (${n}). Not a defect. Mean impact ${impact_avg.toFixed(1)}/5.`,
    opportunity_type: type,
    report_count: n,
    confidence_pct: Math.round(definiteShare * 1000) / 10,
    fingerprint:
      members[0]?.fingerprint ||
      `eoi:${type}:${members.map((m) => m.id).join(",").slice(0, 20)}`,
    educational_impact_avg: Math.round(impact_avg * 100) / 100,
    expected_benefit:
      impact_avg >= 4 ? "High" : impact_avg >= 3 ? "Moderate" : "Incremental",
    target_learners: learners,
    competencies,
    affected_disorders: disorders,
    affected_languages: languages,
    affected_curriculum: recommendation.affected_curriculum,
    difficulty_level: recommendation.difficulty_level,
    educational_rationale: recommendation.educational_rationale,
    learner_benefit: recommendation.expected_learner_benefit,
    research_value: recommendation.research_value,
    effort_estimate: recommendation.estimated_effort,
    educational_priority: recommendation.educational_priority,
    strategic_value: recommendation.strategic_value,
    backlog_score,
    status: "open",
    recommendation,
    member_ids: members.map((m) => m.id),
  };
}

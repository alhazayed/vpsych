/**
 * Quality clustering — groups similar flags without modifying product code.
 */

import { tokenizeIssue } from "@/lib/cqi/fingerprint";
import type { CqiCluster, CqiEngineeringRec, CqiFlagRow } from "@/lib/cqi/types";
import { buildEngineeringRecommendation } from "@/lib/cqi/engineering";

const SEV_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  suggestion: 1,
};

function uniq(xs: Array<string | null | undefined>): string[] {
  return [...new Set(xs.filter((x): x is string => Boolean(x && x.trim())))];
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}

export type ClusterDraft = Omit<CqiCluster, "id"> & {
  member_flag_ids: string[];
  engineering: CqiEngineeringRec;
};

/** Cluster flags by fingerprint exact match, then soft token similarity. */
export function clusterFlags(flags: CqiFlagRow[]): ClusterDraft[] {
  if (!flags.length) return [];

  const byFp = new Map<string, CqiFlagRow[]>();
  for (const f of flags) {
    const key = f.fingerprint || `${f.category}:${f.id}`;
    const list = byFp.get(key) ?? [];
    list.push(f);
    byFp.set(key, list);
  }

  // Soft-merge small singleton clusters with high token overlap + same category
  const groups: CqiFlagRow[][] = [...byFp.values()];
  const merged: CqiFlagRow[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < groups.length; i++) {
    if (used.has(i)) continue;
    let bucket = [...groups[i]!];
    const tokensI = tokenizeIssue(
      bucket.map((f) => f.free_text).join(" "),
    );
    for (let j = i + 1; j < groups.length; j++) {
      if (used.has(j)) continue;
      const other = groups[j]!;
      if (other[0]?.category !== bucket[0]?.category) continue;
      const tokensJ = tokenizeIssue(
        other.map((f) => f.free_text).join(" "),
      );
      if (jaccard(tokensI, tokensJ) >= 0.45) {
        bucket = bucket.concat(other);
        used.add(j);
      }
    }
    used.add(i);
    merged.push(bucket);
  }

  return merged.map((members) => draftFromMembers(members));
}

function draftFromMembers(members: CqiFlagRow[]): ClusterDraft {
  const n = members.length;
  const category = members[0]?.category ?? "other";
  const topSev = members.reduce((best, f) => {
    return (SEV_RANK[f.severity] ?? 0) > (SEV_RANK[best] ?? 0)
      ? f.severity
      : best;
  }, "low");

  const definite = members.filter((m) => m.confidence === "definitely").length;
  const confidence_pct = Math.round(
    ((definite * 1 +
      members.filter((m) => m.confidence === "probably").length * 0.7 +
      members.filter((m) => m.confidence === "possibly").length * 0.4) /
      n) *
      1000,
  ) / 10;

  const titleSeed = tokenizeIssue(members[0]?.free_text ?? category)
    .slice(0, 5)
    .join(" ");
  const title =
    n > 1
      ? `${category.replace(/_/g, " ")}: ${titleSeed || "repeated issue"} (${n})`
      : `${category.replace(/_/g, " ")}: ${titleSeed || "singleton"}`;

  const fingerprint =
    members[0]?.fingerprint ||
    `${category}:${members.map((m) => m.id).sort().join(",").slice(0, 24)}`;

  const ctxVoice = (f: CqiFlagRow) => {
    const c = f.context as { voice?: { voice_id?: string } };
    return c.voice?.voice_id ?? null;
  };

  const engineering = buildEngineeringRecommendation({
    title,
    category,
    severity: topSev,
    report_count: n,
    sample_texts: members.map((m) => m.free_text).slice(0, 5),
    disorders: uniq(members.map((m) => m.disorder_slug)),
    languages: uniq(members.map((m) => m.language)),
    prompts: uniq(members.map((m) => m.prompt_version)),
  });

  return {
    title,
    summary: `Cluster of ${n} expert report(s) on ${category.replace(/_/g, " ")}. Top severity ${topSev}.`,
    category,
    severity: topSev,
    confidence_pct,
    report_count: n,
    fingerprint,
    affected_languages: uniq(members.map((m) => m.language)),
    affected_disorders: uniq(members.map((m) => m.disorder_slug)),
    affected_voices: uniq(members.map(ctxVoice)),
    affected_prompt_versions: uniq(members.map((m) => m.prompt_version)),
    affected_releases: uniq(members.map((m) => m.release_version)),
    affected_models: uniq(
      members.map((m) => (m.context as { llm_model?: string }).llm_model),
    ),
    root_cause: engineering.root_cause,
    educational_impact: estimateEducationalImpact(topSev, category, n),
    clinical_impact: estimateClinicalImpact(topSev, category, n),
    effort_estimate: engineering.priority === "p0" ? "m" : engineering.priority === "p1" ? "s" : "s",
    recommendation: engineering.cursor_prompt.split("\n")[0] ?? engineering.title,
    status: "open",
    engineering,
    member_flag_ids: members.map((m) => m.id),
  };
}

function estimateEducationalImpact(
  severity: string,
  category: string,
  n: number,
): string {
  const base =
    severity === "critical" || severity === "high"
      ? "High — may mis-train assessment or interviewing habits"
      : "Moderate — reduces practice fidelity";
  if (category === "assessment" || category === "educational_value") {
    return `${base}; ${n} corroborating report(s).`;
  }
  return `${base} (${n} reports).`;
}

function estimateClinicalImpact(
  severity: string,
  category: string,
  n: number,
): string {
  if (category === "clinical_realism" || category === "patient_behaviour") {
    return severity === "critical"
      ? `Critical clinical authenticity defect across ${n} observation(s).`
      : `Clinical authenticity concern (${n} observation(s)).`;
  }
  return `Indirect clinical impact via training quality (${n} observation(s)).`;
}

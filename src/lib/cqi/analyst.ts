/**
 * AI Quality Analyst — analyzes vault contents.
 * Does NOT modify application code or production.
 */

import { clusterFlags, type ClusterDraft } from "@/lib/cqi/cluster";
import type { CqiFlagRow } from "@/lib/cqi/types";

export type AnalystReport = {
  analyzed_at: string;
  flag_count: number;
  cluster_count: number;
  clusters: ClusterDraft[];
  repeated_complaints: Array<{ fingerprint: string; n: number; category: string }>;
  affected: {
    disorders: string[];
    languages: string[];
    voices: string[];
    prompts: string[];
    releases: string[];
    models: string[];
  };
  notes: string[];
};

export function runQualityAnalyst(flags: CqiFlagRow[]): AnalystReport {
  const clusters = clusterFlags(flags);
  const fpCount = new Map<string, { n: number; category: string }>();
  for (const f of flags) {
    const cur = fpCount.get(f.fingerprint) ?? {
      n: 0,
      category: f.category,
    };
    cur.n += 1;
    fpCount.set(f.fingerprint, cur);
  }

  const repeated = [...fpCount.entries()]
    .filter(([, v]) => v.n >= 2)
    .map(([fingerprint, v]) => ({ fingerprint, n: v.n, category: v.category }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 25);

  const pick = (fn: (f: CqiFlagRow) => string | null | undefined) =>
    [...new Set(flags.map(fn).filter((x): x is string => Boolean(x)))];

  const notes: string[] = [];
  if (!flags.length) {
    notes.push("Vault empty — no analyst signal yet.");
  } else {
    notes.push(
      `Analyzed ${flags.length} flag(s) into ${clusters.length} cluster(s).`,
    );
    const crit = flags.filter((f) => f.severity === "critical").length;
    if (crit) notes.push(`${crit} critical severity flag(s) require P0 triage.`);
    const edu = flags.filter((f) => f.reduces_educational_quality).length;
    if (edu) {
      notes.push(
        `${edu} flag(s) marked as reducing educational quality.`,
      );
    }
  }
  notes.push(
    "Analyst output is advisory. Engineering recommendations require human approval. No automatic PRs or production changes.",
  );

  return {
    analyzed_at: new Date().toISOString(),
    flag_count: flags.length,
    cluster_count: clusters.length,
    clusters,
    repeated_complaints: repeated,
    affected: {
      disorders: pick((f) => f.disorder_slug),
      languages: pick((f) => f.language),
      voices: pick(
        (f) => (f.context as { voice?: { voice_id?: string } }).voice?.voice_id,
      ),
      prompts: pick((f) => f.prompt_version),
      releases: pick((f) => f.release_version),
      models: pick(
        (f) => (f.context as { llm_model?: string }).llm_model ?? null,
      ),
    },
    notes,
  };
}

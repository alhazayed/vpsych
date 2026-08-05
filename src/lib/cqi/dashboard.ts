import { CQI_VERSION, type CqiDashboard, type CqiFlagRow } from "@/lib/cqi/types";
import type { ClusterDraft } from "@/lib/cqi/cluster";

function avg(
  flags: CqiFlagRow[],
  key: keyof NonNullable<CqiFlagRow["scores"]>,
): number | null {
  const xs = flags
    .map((f) => f.scores?.[key])
    .filter((n): n is number => typeof n === "number");
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

function countBy(
  flags: CqiFlagRow[],
  keyFn: (f: CqiFlagRow) => string | null | undefined,
): Array<{ key: string; n: number }> {
  const m = new Map<string, number>();
  for (const f of flags) {
    const k = keyFn(f);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n);
}

export function buildCqiDashboard(
  flags: CqiFlagRow[],
  clusters: ClusterDraft[],
): CqiDashboard {
  const byCat = countBy(flags, (f) => f.category).map((r) => ({
    category: r.key,
    n: r.n,
  }));
  const bySev = countBy(flags, (f) => f.severity).map((r) => ({
    severity: r.key,
    n: r.n,
  }));
  const byDis = countBy(flags, (f) => f.disorder_slug).map((r) => {
    const subset = flags.filter((f) => f.disorder_slug === r.key);
    return {
      disorder: r.key,
      n: r.n,
      avg_clinical: avg(subset, "clinical_realism") ?? undefined,
    };
  });
  const byLang = countBy(flags, (f) => f.language).map((r) => ({
    language: r.key,
    n: r.n,
  }));

  const residency = flags.filter((f) => f.usable_in_residency != null);
  const recommend = flags.filter((f) => f.would_recommend != null);

  return {
    cqi_version: CQI_VERSION,
    generated_at: new Date().toISOString(),
    totals: {
      flags: flags.length,
      clusters: clusters.length,
      critical: flags.filter((f) => f.severity === "critical").length,
      high: flags.filter((f) => f.severity === "high").length,
      open_clusters: clusters.filter((c) => c.status === "open").length,
    },
    by_category: byCat,
    by_severity: bySev,
    by_disorder: byDis,
    by_language: byLang,
    top_clusters: clusters
      .slice()
      .sort((a, b) => b.report_count - a.report_count)
      .slice(0, 15)
      .map((c) => ({
        title: c.title,
        report_count: c.report_count,
        severity: c.severity,
        confidence_pct: c.confidence_pct,
      })),
    score_averages: {
      clinical_realism: avg(flags, "clinical_realism"),
      conversation_realism: avg(flags, "conversation_realism"),
      educational_usefulness: avg(flags, "educational_usefulness"),
      voice_realism: avg(flags, "voice_realism"),
      assessment_quality: avg(flags, "assessment_quality"),
    },
    trends: {
      by_release: countBy(flags, (f) => f.release_version).map((r) => ({
        release: r.key,
        n: r.n,
      })),
      by_prompt: countBy(flags, (f) => f.prompt_version).map((r) => ({
        prompt: r.key,
        n: r.n,
      })),
    },
    residency_usable_rate: residency.length
      ? Math.round(
          (residency.filter((f) => f.usable_in_residency).length /
            residency.length) *
            1000,
        ) / 10
      : null,
    recommend_rate: recommend.length
      ? Math.round(
          (recommend.filter((f) => f.would_recommend).length /
            recommend.length) *
            1000,
        ) / 10
      : null,
  };
}

/**
 * Multi-level VQI aggregation + dashboard builder.
 */

import type {
  VPsychQualityIndex,
  VqiDashboardData,
  VqiEntityType,
  VqiTrendPoint,
} from "@/lib/vqi/types";
import type { VqiWeightSet } from "@/lib/vqi/weights";
import { VQI_VERSION } from "@/lib/vqi/weights";
import { buildTrendSeries } from "@/lib/vqi/trends";
import { buildBenchmarkSuite } from "@/lib/vqi/benchmark";
import { issueQualityCertificate } from "@/lib/vqi/certificate";

export type StoredVqiRecord = {
  overall: number;
  entity_type: VqiEntityType;
  entity_id: string;
  computed_at: string;
  vqi: VPsychQualityIndex;
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

export function aggregateEntityVqi(
  entity_type: VqiEntityType,
  entity_id: string,
  records: StoredVqiRecord[],
  template: VPsychQualityIndex,
): VPsychQualityIndex {
  const xs = records.map((r) => r.overall);
  const overall = Math.round(mean(xs) * 10) / 10;
  return {
    ...template,
    overall,
    entity_type,
    entity_id,
    scientific_interpretation: [
      `Aggregated VQI ${overall}/100 across ${xs.length} ${entity_type} observations for ${entity_id}.`,
      template.scientific_interpretation,
    ].join(" "),
  };
}

export function buildVqiDashboard(
  records: StoredVqiRecord[],
  weightSet: VqiWeightSet,
): VqiDashboardData {
  const platform =
    records.find((r) => r.entity_type === "platform")?.vqi ??
    records[0]?.vqi ??
    null;

  const byEntity = records.map((r) => ({
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    overall: r.overall,
    maturity: r.vqi.maturity,
    n: 1,
  }));

  const trends: VqiTrendPoint[] = buildTrendSeries(
    records.map((r) => ({ at: r.computed_at, overall: r.overall })),
    "day",
  );

  const overalls = records.map((r) => r.overall);
  const platformAvg = mean(overalls);
  const benchmarks = platform
    ? buildBenchmarkSuite({
        current: platform.overall,
        platform_avg: platformAvg,
        previous_assessment: records.length > 1 ? records[1]!.overall : null,
      })
    : [];

  const heat_map: VqiDashboardData["heat_map"] = [];
  for (const r of records) {
    for (const s of r.vqi.subscores) {
      if (s.score == null) continue;
      heat_map.push({
        row: `${r.entity_type}:${r.entity_id}`,
        col: s.metric_id,
        value: s.score,
      });
    }
  }

  const radar =
    platform?.subscores
      .filter((s) => s.score != null)
      .map((s) => ({ metric_id: s.metric_id, score: s.score! })) ?? [];

  const buckets = [
    { bucket: "<60", n: 0 },
    { bucket: "60-74", n: 0 },
    { bucket: "75-84", n: 0 },
    { bucket: "85-94", n: 0 },
    { bucket: "95-100", n: 0 },
  ];
  for (const o of overalls) {
    if (o < 60) buckets[0]!.n += 1;
    else if (o < 75) buckets[1]!.n += 1;
    else if (o < 85) buckets[2]!.n += 1;
    else if (o < 95) buckets[3]!.n += 1;
    else buckets[4]!.n += 1;
  }

  const m = mean(overalls);
  const s = sd(overalls);
  const outliers = records
    .filter((r) => s > 0 && Math.abs(r.overall - m) > 2 * s)
    .map((r) => ({
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      overall: r.overall,
    }));

  const recommendations = new Set<string>();
  for (const r of records) {
    if (r.overall < 85) {
      for (const rec of r.vqi.recommendations.slice(0, 2)) recommendations.add(rec);
    }
  }

  return {
    vqi_version: VQI_VERSION,
    weight_set: weightSet,
    platform_vqi: platform,
    certificate: platform ? issueQualityCertificate(platform) : null,
    by_entity: byEntity,
    trends,
    benchmarks,
    heat_map: heat_map.slice(0, 200),
    radar,
    distribution: buckets,
    outliers,
    recommendations: [...recommendations].slice(0, 15),
  };
}

/**
 * Aggregate RRS for research dashboard.
 */

import type {
  ResearchReadinessScore,
  RrsDashboardData,
  VersionMatrixRow,
  ReproducibilityMatrixRow,
} from "@/lib/rrs/types";
import { RRS_VERSION } from "@/lib/rrs/weights";

export type StoredRrsRecord = {
  overall: number;
  dataset_id: string;
  computed_at: string;
  rrs: ResearchReadinessScore;
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function buildRrsDashboard(records: StoredRrsRecord[]): RrsDashboardData {
  const overalls = records.map((r) => r.overall);
  const dimMeans = new Map<string, number[]>();
  const completeness: number[] = [];
  const integrity: number[] = [];
  const metadata: number[] = [];

  for (const r of records) {
    for (const s of r.rrs.subscores) {
      const xs = dimMeans.get(s.id) ?? [];
      xs.push(s.score);
      dimMeans.set(s.id, xs);
      if (s.id === "data_completeness") completeness.push(s.score);
      if (s.id === "data_integrity") integrity.push(s.score);
      if (s.id === "metadata_completeness") metadata.push(s.score);
    }
  }

  const lowRecs = new Set<string>();
  for (const r of records) {
    if (r.overall < 80) {
      for (const rec of r.rrs.recommendations.slice(0, 4)) lowRecs.add(rec);
    }
  }

  const hotspots = [...dimMeans.entries()]
    .map(([id, xs]) => ({
      id,
      mean: Math.round(mean(xs) * 10) / 10,
      n: xs.length,
    }))
    .sort((a, b) => a.mean - b.mean)
    .slice(0, 6);

  const latest = records[0]?.rrs;
  const version_matrix: VersionMatrixRow[] = latest?.version_matrix ?? [];
  const reproducibility_matrix: ReproducibilityMatrixRow[] =
    latest?.reproducibility_matrix ?? [];

  return {
    rrs_version: RRS_VERSION,
    overall_mean: overalls.length
      ? Math.round(mean(overalls) * 10) / 10
      : null,
    n: records.length,
    publication_readiness: {
      mean_rrs: overalls.length
        ? Math.round(mean(overalls) * 10) / 10
        : null,
      low_dimension_hotspots: hotspots,
      recommendations: [...lowRecs].slice(0, 10),
    },
    dataset_quality: {
      mean_completeness: completeness.length
        ? Math.round(mean(completeness) * 10) / 10
        : null,
      mean_integrity: integrity.length
        ? Math.round(mean(integrity) * 10) / 10
        : null,
      mean_metadata: metadata.length
        ? Math.round(mean(metadata) * 10) / 10
        : null,
    },
    version_matrix,
    reproducibility_matrix,
    low_rrs_recommendations: [...lowRecs].slice(0, 15),
  };
}

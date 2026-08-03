/**
 * Aggregate AVI scores for assessment quality dashboard.
 */

import type {
  AssessmentValidityIndex,
  AviAggregateRow,
  AviDashboardData,
} from "@/lib/avi/types";
import { AVI_VERSION } from "@/lib/avi/weights";

export type StoredAviRecord = {
  overall: number;
  variance: number | null;
  locale: string;
  assessment_mode: string | null;
  computed_at: string;
  avi: AssessmentValidityIndex;
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function aggregate(key: string, scores: number[]): AviAggregateRow {
  const m = mean(scores);
  const s = sd(scores);
  const se = scores.length ? s / Math.sqrt(scores.length) : 0;
  const margin = 1.96 * se;
  return {
    key,
    n: scores.length,
    mean: Math.round(m * 10) / 10,
    sd: Math.round(s * 10) / 10,
    min: scores.length ? Math.min(...scores) : 0,
    max: scores.length ? Math.max(...scores) : 0,
    ci95: {
      lower: Math.round(Math.max(0, m - margin) * 10) / 10,
      upper: Math.round(Math.min(100, m + margin) * 10) / 10,
    },
  };
}

export function buildAviDashboard(records: StoredAviRecord[]): AviDashboardData {
  const overalls = records.map((r) => r.overall);
  const variances = records
    .map((r) => r.variance)
    .filter((v): v is number => v != null);
  const byMode = new Map<string, number[]>();
  const byLang = new Map<string, number[]>();
  const byDay = new Map<string, { scores: number[]; vars: number[] }>();
  const dimMeans = new Map<string, number[]>();
  let heuristic = 0;

  for (const r of records) {
    const mode = r.assessment_mode ?? "unknown";
    const mArr = byMode.get(mode) ?? [];
    mArr.push(r.overall);
    byMode.set(mode, mArr);

    const lang = r.locale.split("-")[0] ?? r.locale;
    const lArr = byLang.get(lang) ?? [];
    lArr.push(r.overall);
    byLang.set(lang, lArr);

    const day = r.computed_at.slice(0, 10);
    const bucket = byDay.get(day) ?? { scores: [], vars: [] };
    bucket.scores.push(r.overall);
    if (r.variance != null) bucket.vars.push(r.variance);
    byDay.set(day, bucket);

    if (r.assessment_mode === "heuristic_fallback") heuristic += 1;
    for (const s of r.avi.subscores) {
      const xs = dimMeans.get(s.id) ?? [];
      xs.push(s.score);
      dimMeans.set(s.id, xs);
    }
  }

  const stability_trend = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, b]) => ({
      at,
      mean: Math.round(mean(b.scores) * 10) / 10,
      variance: b.vars.length
        ? Math.round(mean(b.vars) * 100) / 100
        : null,
      n: b.scores.length,
    }));

  const lowRecs = new Set<string>();
  for (const r of records) {
    if (r.overall < 75) {
      for (const rec of r.avi.recommendations.slice(0, 3)) lowRecs.add(rec);
    }
  }

  const hotspots = [...dimMeans.entries()]
    .map(([id, xs]) => ({
      id,
      mean: Math.round(mean(xs) * 10) / 10,
      n: xs.length,
    }))
    .sort((a, b) => a.mean - b.mean)
    .slice(0, 5);

  return {
    avi_version: AVI_VERSION,
    overall_mean: overalls.length
      ? Math.round(mean(overalls) * 10) / 10
      : null,
    n: records.length,
    mean_variance: variances.length
      ? Math.round(mean(variances) * 100) / 100
      : null,
    stability_trend,
    validity_summary: {
      mean_avi: overalls.length
        ? Math.round(mean(overalls) * 10) / 10
        : null,
      low_dimension_hotspots: hotspots,
      heuristic_share: records.length
        ? Math.round((heuristic / records.length) * 1000) / 10
        : null,
      external_criterion_disclosed: true,
      recommendations: [...lowRecs].slice(0, 10),
    },
    by_mode: [...byMode.entries()]
      .map(([k, xs]) => aggregate(k, xs))
      .sort((a, b) => a.key.localeCompare(b.key)),
    by_language: [...byLang.entries()]
      .map(([k, xs]) => aggregate(k, xs))
      .sort((a, b) => a.key.localeCompare(b.key)),
    low_avi_recommendations: [...lowRecs].slice(0, 15),
  };
}

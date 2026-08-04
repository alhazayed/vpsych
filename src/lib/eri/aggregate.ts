/**
 * Aggregate ERI scores for educational dashboard.
 */

import type {
  EriAggregateRow,
  EriDashboardData,
  EducationalReliabilityIndex,
} from "@/lib/eri/types";
import { ERI_VERSION } from "@/lib/eri/weights";

export type StoredEriRecord = {
  overall: number;
  locale: string;
  difficulty: string | null;
  assessment_mode: string | null;
  learner_id: string | null;
  computed_at: string;
  eri: EducationalReliabilityIndex;
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function aggregate(key: string, scores: number[]): EriAggregateRow {
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

export function buildEriDashboard(records: StoredEriRecord[]): EriDashboardData {
  const overalls = records.map((r) => r.overall);
  const byDiff = new Map<string, number[]>();
  const byLang = new Map<string, number[]>();
  const byDay = new Map<string, number[]>();
  const dimMeans = new Map<string, number[]>();
  let heuristic = 0;

  for (const r of records) {
    const dKey = r.difficulty ?? "unset";
    const d = byDiff.get(dKey) ?? [];
    d.push(r.overall);
    byDiff.set(dKey, d);

    const lang = r.locale.split("-")[0] ?? r.locale;
    const l = byLang.get(lang) ?? [];
    l.push(r.overall);
    byLang.set(lang, l);

    const day = r.computed_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(r.overall);
    byDay.set(day, arr);

    if (r.assessment_mode === "heuristic_fallback") heuristic += 1;
    for (const s of r.eri.subscores) {
      const xs = dimMeans.get(s.id) ?? [];
      xs.push(s.score);
      dimMeans.set(s.id, xs);
    }
  }

  const learner_trend = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, xs]) => ({
      at,
      mean: Math.round(mean(xs) * 10) / 10,
      n: xs.length,
    }));

  const lowRecs = new Set<string>();
  for (const r of records) {
    if (r.overall < 75) {
      for (const rec of r.eri.recommendations.slice(0, 3)) lowRecs.add(rec);
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
    eri_version: ERI_VERSION,
    overall_mean: overalls.length
      ? Math.round(mean(overalls) * 10) / 10
      : null,
    n: records.length,
    learner_trend,
    instructor_report: {
      mean_eri: overalls.length
        ? Math.round(mean(overalls) * 10) / 10
        : null,
      low_dimension_hotspots: hotspots,
      heuristic_share: records.length
        ? Math.round((heuristic / records.length) * 1000) / 10
        : null,
      recommendations: [...lowRecs].slice(0, 10),
    },
    by_difficulty: [...byDiff.entries()]
      .map(([k, xs]) => aggregate(k, xs))
      .sort((a, b) => a.key.localeCompare(b.key)),
    by_language: [...byLang.entries()]
      .map(([k, xs]) => aggregate(k, xs))
      .sort((a, b) => a.key.localeCompare(b.key)),
    low_eri_recommendations: [...lowRecs].slice(0, 15),
  };
}

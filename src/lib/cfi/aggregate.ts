/**
 * Aggregate CFI scores for dashboard: trends, per-disorder, per-language.
 */

import type {
  CfiAggregateRow,
  CfiDashboardData,
  ClinicalFidelityIndex,
} from "@/lib/cfi/types";
import { CFI_VERSION } from "@/lib/cfi/weights";

export type StoredCfiRecord = {
  overall: number;
  disorder_slug: string;
  locale: string;
  computed_at: string;
  cfi: ClinicalFidelityIndex;
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function aggregate(key: string, scores: number[]): CfiAggregateRow {
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

export function buildCfiDashboard(records: StoredCfiRecord[]): CfiDashboardData {
  const overalls = records.map((r) => r.overall);
  const byDisorder = new Map<string, number[]>();
  const byLang = new Map<string, number[]>();
  for (const r of records) {
    const d = byDisorder.get(r.disorder_slug) ?? [];
    d.push(r.overall);
    byDisorder.set(r.disorder_slug, d);
    const lang = r.locale.split("-")[0] ?? r.locale;
    const l = byLang.get(lang) ?? [];
    l.push(r.overall);
    byLang.set(lang, l);
  }

  // Trend by day
  const byDay = new Map<string, number[]>();
  for (const r of records) {
    const day = r.computed_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(r.overall);
    byDay.set(day, arr);
  }
  const trend = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, xs]) => ({
      at,
      mean: Math.round(mean(xs) * 10) / 10,
      n: xs.length,
    }));

  const lowRecs = new Set<string>();
  for (const r of records) {
    if (r.overall < 75) {
      for (const rec of r.cfi.recommendations.slice(0, 3)) lowRecs.add(rec);
    }
  }

  return {
    cfi_version: CFI_VERSION,
    overall_mean: overalls.length
      ? Math.round(mean(overalls) * 10) / 10
      : null,
    n: records.length,
    trend,
    by_disorder: [...byDisorder.entries()]
      .map(([k, xs]) => aggregate(k, xs))
      .sort((a, b) => a.mean - b.mean),
    by_language: [...byLang.entries()]
      .map(([k, xs]) => aggregate(k, xs))
      .sort((a, b) => a.key.localeCompare(b.key)),
    low_cfi_recommendations: [...lowRecs].slice(0, 15),
  };
}

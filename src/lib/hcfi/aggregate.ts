/**
 * Aggregate HCFI scores for dashboards and historical tracking.
 */

import type {
  HcfiAggregateRow,
  HcfiDashboardData,
  HumanConversationFidelityIndex,
} from "@/lib/hcfi/types";
import { HCFI_VERSION } from "@/lib/hcfi/weights";

export type StoredHcfiRecord = {
  overall: number;
  disorder_slug: string;
  locale: string;
  computed_at: string;
  hcfi: HumanConversationFidelityIndex;
};

/** In-process history for continuous HCFI tracking (Mission 20). */
const HISTORY: StoredHcfiRecord[] = [];

export function recordHcfiHistory(record: StoredHcfiRecord): void {
  HISTORY.push(record);
  if (HISTORY.length > 5000) HISTORY.splice(0, HISTORY.length - 5000);
}

export function listHcfiHistory(limit = 500): StoredHcfiRecord[] {
  return HISTORY.slice(-limit);
}

export function clearHcfiHistory(): void {
  HISTORY.length = 0;
}

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function aggregate(key: string, scores: number[]): HcfiAggregateRow {
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

export function buildHcfiDashboard(
  records: StoredHcfiRecord[],
): HcfiDashboardData {
  const overalls = records.map((r) => r.overall);
  const byDisorder = new Map<string, number[]>();
  const byLocale = new Map<string, number[]>();
  for (const r of records) {
    const d = byDisorder.get(r.disorder_slug) ?? [];
    d.push(r.overall);
    byDisorder.set(r.disorder_slug, d);
    const lang = r.locale.split("-")[0] ?? r.locale;
    const l = byLocale.get(lang) ?? [];
    l.push(r.overall);
    byLocale.set(lang, l);
  }

  const timelineMap = new Map<string, number[]>();
  for (const r of records) {
    const day = r.computed_at.slice(0, 10);
    const xs = timelineMap.get(day) ?? [];
    xs.push(r.overall);
    timelineMap.set(day, xs);
  }

  const meanOverall = mean(overalls);
  const recommendations: string[] = [];
  if (meanOverall < 75) {
    recommendations.push(
      "Mean HCFI < 75 — prioritize natural language and clinical speech profiles.",
    );
  }
  if ((byLocale.get("ar")?.length ?? 0) > 0) {
    const arMean = mean(byLocale.get("ar")!);
    if (arMean + 5 < meanOverall) {
      recommendations.push(
        "Arabic HCFI lags English — strengthen dialect authenticity and script fidelity.",
      );
    }
  }

  return {
    hcfi_version: HCFI_VERSION,
    n: records.length,
    mean_overall: Math.round(meanOverall * 10) / 10,
    by_disorder: [...byDisorder.entries()].map(([k, v]) => aggregate(k, v)),
    by_locale: [...byLocale.entries()].map(([k, v]) => aggregate(k, v)),
    timeline: [...timelineMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([at, xs]) => ({
        at,
        mean: Math.round(mean(xs) * 10) / 10,
        n: xs.length,
      })),
    recommendations,
  };
}

/**
 * Longitudinal trends, drift, and moving averages for VQI.
 */

import type { VqiTrendPoint } from "@/lib/vqi/types";

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function periodKey(iso: string, period: VqiTrendPoint["period"]): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (period === "day") {
    return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (period === "week") {
    const tmp = new Date(Date.UTC(y, m - 1, day));
    const week = Math.ceil(
      ((tmp.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7,
    );
    return `${y}-W${String(week).padStart(2, "0")}`;
  }
  if (period === "month") return `${y}-${String(m).padStart(2, "0")}`;
  if (period === "quarter") return `${y}-Q${Math.ceil(m / 3)}`;
  return String(y);
}

export function buildTrendSeries(
  points: Array<{ at: string; overall: number }>,
  period: VqiTrendPoint["period"] = "day",
): VqiTrendPoint[] {
  const buckets = new Map<string, number[]>();
  for (const p of points) {
    const key = periodKey(p.at, period);
    const arr = buckets.get(key) ?? [];
    arr.push(p.overall);
    buckets.set(key, arr);
  }
  const series = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, xs]) => ({
      at,
      period,
      mean: Math.round(mean(xs) * 10) / 10,
      n: xs.length,
      moving_average_7: null as number | null,
    }));

  // Simple trailing moving average over up to 7 points
  for (let i = 0; i < series.length; i++) {
    const window = series.slice(Math.max(0, i - 6), i + 1).map((s) => s.mean);
    series[i]!.moving_average_7 = Math.round(mean(window) * 10) / 10;
  }
  return series;
}

export function detectQualityDrift(
  series: VqiTrendPoint[],
): {
  drift: "improving" | "stable" | "regressing" | "insufficient";
  delta: number | null;
} {
  if (series.length < 2) return { drift: "insufficient", delta: null };
  const first = series[0]!.mean;
  const last = series[series.length - 1]!.mean;
  const delta = Math.round((last - first) * 10) / 10;
  if (delta >= 3) return { drift: "improving", delta };
  if (delta <= -3) return { drift: "regressing", delta };
  return { drift: "stable", delta };
}

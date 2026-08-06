/**
 * Research-grade statistics over real observations only.
 * Returns insufficient_data rather than inventing scores.
 */

export function mean(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[], sample = true): number | null {
  if (xs.length < (sample ? 2 : 1)) return null;
  const m = mean(xs);
  if (m == null) return null;
  const denom = sample ? xs.length - 1 : xs.length;
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / denom;
}

export function stdev(xs: number[], sample = true): number | null {
  const v = variance(xs, sample);
  return v == null ? null : Math.sqrt(v);
}

/** Normal approx 95% CI for a mean. */
export function ci95Mean(xs: number[]): { lower: number; upper: number } | null {
  if (xs.length < 2) return null;
  const m = mean(xs);
  const s = stdev(xs);
  if (m == null || s == null) return null;
  const se = s / Math.sqrt(xs.length);
  const z = 1.96;
  return { lower: m - z * se, upper: m + z * se };
}

/** Cohen's d for two independent samples. */
export function cohensD(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  const sa = variance(a);
  const sb = variance(b);
  if (ma == null || mb == null || sa == null || sb == null) return null;
  const pooled = Math.sqrt(
    ((a.length - 1) * sa + (b.length - 1) * sb) / (a.length + b.length - 2),
  );
  if (pooled === 0) return 0;
  return (ma - mb) / pooled;
}

/**
 * Simplified ICC(2,1) approximation via one-way ANOVA on rating matrix.
 * rows = items, cols = raters. Requires ≥2 raters and ≥2 items.
 */
export function icc2Approx(matrix: number[][]): number | null {
  const n = matrix.length;
  if (n < 2) return null;
  const k = matrix[0]?.length ?? 0;
  if (k < 2) return null;
  if (!matrix.every((row) => row.length === k)) return null;

  const grand = mean(matrix.flat());
  if (grand == null) return null;

  let ssb = 0;
  for (const row of matrix) {
    const rm = mean(row);
    if (rm == null) return null;
    ssb += k * (rm - grand) ** 2;
  }
  let ssw = 0;
  for (const row of matrix) {
    const rm = mean(row)!;
    for (const x of row) ssw += (x - rm) ** 2;
  }
  const dfb = n - 1;
  const dfw = n * (k - 1);
  if (dfb <= 0 || dfw <= 0) return null;
  const msb = ssb / dfb;
  const msw = ssw / dfw;
  const denom = msb + (k - 1) * msw;
  if (denom === 0) return null;
  return (msb - msw) / denom;
}

export function likertTo100(v: number): number {
  return Math.round(((Math.min(5, Math.max(1, v)) - 1) / 4) * 1000) / 10;
}

export function clamp01to100(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}

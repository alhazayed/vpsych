/**
 * Shared scoring helpers for Stage 8 validation (pure, deterministic).
 */

export function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export function weightedMean(
  items: Array<{ score: number; weight: number }>,
): number {
  let num = 0;
  let den = 0;
  for (const it of items) {
    num += it.score * it.weight;
    den += it.weight;
  }
  if (den <= 0) return 0;
  return clamp01to100(num / den);
}

export function approxCi(
  score: number,
  confidence: number,
  method = "dimension_uncertainty",
): { lower: number; upper: number; level: 0.95; method: string } {
  const spread = Math.max(2, (100 - confidence) * 0.35);
  return {
    lower: clamp01to100(score - spread),
    upper: clamp01to100(score + spread),
    level: 0.95,
    method,
  };
}

export function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1);
}

export function stddev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

/** Pearson r — null when undefined. */
export function pearson(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

/** Deterministic hash → [0,1) for reproducible simulations. */
export function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function stableId(prefix: string, seed: string): string {
  const h = Math.floor(hashUnit(seed) * 1e12)
    .toString(16)
    .padStart(10, "0");
  return `${prefix}_${h}`;
}

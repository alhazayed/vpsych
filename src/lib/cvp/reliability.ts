/**
 * Inter-rater agreement and reliability statistics for Clinical Validation.
 * Pure functions — no simulation behaviour changes.
 */

import { cronbachAlpha, mean, pearson } from "@/lib/scientific/psychometrics";
import type { InterRaterResult, ReliabilityReport } from "./types";

function interpretKappa(k: number | null): string {
  if (k === null) return "insufficient_data";
  if (k < 0) return "poor";
  if (k < 0.2) return "slight";
  if (k < 0.4) return "fair";
  if (k < 0.6) return "moderate";
  if (k < 0.8) return "substantial";
  return "almost_perfect";
}

function interpretIcc(v: number | null): string {
  if (v === null) return "insufficient_data";
  if (v < 0.5) return "poor";
  if (v < 0.75) return "moderate";
  if (v < 0.9) return "good";
  return "excellent";
}

/**
 * Cohen's kappa for two raters, ordinal categories 1..k (default k=5).
 * Unweighted; suitable for discrete Likert agreement.
 */
export function cohensKappa(
  raterA: number[],
  raterB: number[],
  categories = [1, 2, 3, 4, 5],
): InterRaterResult {
  const n = Math.min(raterA.length, raterB.length);
  if (n < 2) {
    return {
      method: "cohens_kappa",
      value: null,
      n_items: n,
      n_raters: 2,
      interpretation: "insufficient_data",
      notes: "Need ≥2 paired ratings",
    };
  }
  const a = raterA.slice(0, n);
  const b = raterB.slice(0, n);
  const k = categories.length;
  const matrix: number[][] = Array.from({ length: k }, () =>
    Array.from({ length: k }, () => 0),
  );
  const index = new Map(categories.map((c, i) => [c, i]));
  for (let i = 0; i < n; i++) {
    const ia = index.get(a[i]!);
    const ib = index.get(b[i]!);
    if (ia === undefined || ib === undefined) continue;
    matrix[ia]![ib]! += 1;
  }
  let agree = 0;
  const row: number[] = Array(k).fill(0);
  const col: number[] = Array(k).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      const c = matrix[i]![j]!;
      row[i]! += c;
      col[j]! += c;
      if (i === j) agree += c;
    }
  }
  const po = agree / n;
  let pe = 0;
  for (let i = 0; i < k; i++) {
    pe += (row[i]! / n) * (col[i]! / n);
  }
  const value = pe === 1 ? 1 : (po - pe) / (1 - pe);
  return {
    method: "cohens_kappa",
    value: Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null,
    n_items: n,
    n_raters: 2,
    interpretation: interpretKappa(
      Number.isFinite(value) ? value : null,
    ),
    notes: "Unweighted Cohen's κ on ordinal categories",
  };
}

/**
 * Fleiss' kappa for m raters × n items, each cell a category in categories.
 * Input: ratings[item][rater] = category value.
 */
export function fleissKappa(
  ratings: number[][],
  categories = [1, 2, 3, 4, 5],
): InterRaterResult {
  const n = ratings.length;
  if (n < 2) {
    return {
      method: "fleiss_kappa",
      value: null,
      n_items: n,
      n_raters: 0,
      interpretation: "insufficient_data",
      notes: "Need ≥2 items",
    };
  }
  const m = ratings[0]?.length ?? 0;
  if (m < 2) {
    return {
      method: "fleiss_kappa",
      value: null,
      n_items: n,
      n_raters: m,
      interpretation: "insufficient_data",
      notes: "Need ≥2 raters",
    };
  }
  const k = categories.length;
  const index = new Map(categories.map((c, i) => [c, i]));
  const counts: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: k }, () => 0),
  );
  for (let i = 0; i < n; i++) {
    for (const r of ratings[i] ?? []) {
      const j = index.get(r);
      if (j !== undefined) counts[i]![j]! += 1;
    }
  }
  let pBar = 0;
  for (let i = 0; i < n; i++) {
    let sumSq = 0;
    for (let j = 0; j < k; j++) sumSq += counts[i]![j]! ** 2;
    pBar += (sumSq - m) / (m * (m - 1));
  }
  pBar /= n;
  const pj: number[] = Array(k).fill(0);
  for (let j = 0; j < k; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += counts[i]![j]!;
    pj[j] = s / (n * m);
  }
  const pe = pj.reduce((a, p) => a + p * p, 0);
  const value = pe === 1 ? 1 : (pBar - pe) / (1 - pe);
  return {
    method: "fleiss_kappa",
    value: Number.isFinite(value) ? Math.round(value * 1000) / 1000 : null,
    n_items: n,
    n_raters: m,
    interpretation: interpretKappa(Number.isFinite(value) ? value : null),
    notes: "Fleiss' κ for multiple raters",
  };
}

/**
 * ICC(2,1) two-way random, single measure (Shrout & Fleiss approximation).
 * Matrix: rows = targets (sessions), cols = raters.
 */
export function icc21(matrix: number[][]): InterRaterResult {
  const n = matrix.length;
  const k = matrix[0]?.length ?? 0;
  if (n < 2 || k < 2) {
    return {
      method: "icc_2_1",
      value: null,
      n_items: n,
      n_raters: k,
      interpretation: "insufficient_data",
      notes: "Need ≥2 targets and ≥2 raters",
    };
  }
  const grand = mean(matrix.flat());
  let ssRows = 0;
  let ssCols = 0;
  let ssErr = 0;
  const rowMeans = matrix.map((row) => mean(row));
  const colMeans: number[] = [];
  for (let j = 0; j < k; j++) {
    colMeans.push(mean(matrix.map((row) => row[j]!)));
  }
  for (let i = 0; i < n; i++) {
    ssRows += k * (rowMeans[i]! - grand) ** 2;
  }
  for (let j = 0; j < k; j++) {
    ssCols += n * (colMeans[j]! - grand) ** 2;
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < k; j++) {
      const expected = rowMeans[i]! + colMeans[j]! - grand;
      ssErr += (matrix[i]![j]! - expected) ** 2;
    }
  }
  const msr = ssRows / (n - 1);
  const msc = ssCols / (k - 1);
  const mse = ssErr / ((n - 1) * (k - 1));
  const denom = msr + (k - 1) * mse + (k * (msc - mse)) / n;
  const value = denom === 0 ? null : (msr - mse) / denom;
  return {
    method: "icc_2_1",
    value:
      value !== null && Number.isFinite(value)
        ? Math.round(value * 1000) / 1000
        : null,
    n_items: n,
    n_raters: k,
    interpretation: interpretIcc(
      value !== null && Number.isFinite(value) ? value : null,
    ),
    notes: "ICC(2,1) two-way random effects, single measure",
  };
}

/**
 * Build a reliability report from dual-rating score matrices.
 * `items` = sessions; each item maps raterId → overall likert (or mean of scales).
 */
export function buildReliabilityReport(input: {
  /** sessionKey → raterId → score */
  dualScores: Record<string, Record<string, number>>;
  /** optional items×subjects matrix for Cronbach */
  cronbachMatrix?: number[][];
  now?: Date;
}): ReliabilityReport {
  const sessions = Object.keys(input.dualScores);
  const raterSet = new Set<string>();
  for (const s of sessions) {
    for (const r of Object.keys(input.dualScores[s] ?? {})) raterSet.add(r);
  }
  const raters = [...raterSet];

  let cohens: InterRaterResult | null = null;
  let fleiss: InterRaterResult | null = null;
  let icc: InterRaterResult | null = null;
  let pearsonR: number | null = null;

  if (raters.length >= 2) {
    const r0 = raters[0]!;
    const r1 = raters[1]!;
    const a: number[] = [];
    const b: number[] = [];
    const matrix: number[][] = [];
    const fleissRows: number[][] = [];

    for (const s of sessions) {
      const row = input.dualScores[s] ?? {};
      const scores = raters.map((r) => row[r]).filter((v): v is number => v != null);
      if (scores.length >= 2) fleissRows.push(scores);
      if (row[r0] != null && row[r1] != null) {
        a.push(row[r0]!);
        b.push(row[r1]!);
        matrix.push(raters.map((r) => row[r] ?? mean(scores)));
      }
    }
    cohens = cohensKappa(a, b);
    fleiss = fleissKappa(fleissRows);
    icc = icc21(matrix);
    pearsonR = pearson(a, b);
    if (pearsonR != null) pearsonR = Math.round(pearsonR * 1000) / 1000;
  }

  return {
    cronbach_alpha: input.cronbachMatrix
      ? cronbachAlpha(input.cronbachMatrix)
      : null,
    cohens_kappa: cohens,
    fleiss_kappa: fleiss,
    icc,
    pearson_inter_rater: pearsonR,
    sample_sessions: sessions.length,
    sample_raters: raters.length,
    generated_at: (input.now ?? new Date()).toISOString(),
    disclaimer:
      "Formative reliability estimates from the Clinical Validation cohort — not published coefficients until pre-registered analysis and peer review.",
  };
}

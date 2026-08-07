/**
 * Inter-rater Engine — agreement, Cohen's kappa, ICC, weighted agreement.
 * Never fabricates significance when underpowered.
 */

import { clamp01to100, mean, pearson, variance } from "@/lib/validation/helpers";
import type {
  ExpertRating,
  ExpertRatingDomain,
  InterRaterResult,
} from "@/lib/validation/types";

const MIN_CASES_FOR_INFERENCE = 5;
const MIN_RATERS = 2;

function binScore(score: number, scaleMax: number, bins = 5): number {
  const ratio = scaleMax > 0 ? score / scaleMax : 0;
  return Math.min(bins - 1, Math.max(0, Math.floor(ratio * bins)));
}

/** Percent agreement on binned scores for a domain. */
export function percentAgreement(
  ratings: ExpertRating[],
  domain: ExpertRatingDomain,
): number | null {
  const subset = ratings.filter((r) => r.domain === domain);
  const byCase = new Map<string, number[]>();
  for (const r of subset) {
    const arr = byCase.get(r.case_key) ?? [];
    arr.push(binScore(r.score, r.scale_max));
    byCase.set(r.case_key, arr);
  }
  let agree = 0;
  let total = 0;
  for (const bins of byCase.values()) {
    if (bins.length < 2) continue;
    total += 1;
    const first = bins[0]!;
    if (bins.every((b) => b === first)) agree += 1;
  }
  if (!total) return null;
  return clamp01to100((agree / total) * 100);
}

/**
 * Cohen's kappa for two raters on binned categorical ratings.
 * Returns null if fewer than 2 complete paired cases.
 */
export function cohenKappa(
  raterA: number[],
  raterB: number[],
  categories: number,
): number | null {
  if (raterA.length !== raterB.length || raterA.length < 2) return null;
  const n = raterA.length;
  const matrix: number[][] = Array.from({ length: categories }, () =>
    Array.from({ length: categories }, () => 0),
  );
  for (let i = 0; i < n; i++) {
    const a = Math.min(categories - 1, Math.max(0, raterA[i]!));
    const b = Math.min(categories - 1, Math.max(0, raterB[i]!));
    matrix[a]![b]! += 1;
  }
  let po = 0;
  for (let i = 0; i < categories; i++) po += matrix[i]![i]! / n;
  const row: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < categories; i++) {
    row.push(matrix[i]!.reduce((s, x) => s + x, 0) / n);
    let c = 0;
    for (let j = 0; j < categories; j++) c += matrix[j]![i]!;
    col.push(c / n);
  }
  let pe = 0;
  for (let i = 0; i < categories; i++) pe += row[i]! * col[i]!;
  if (pe === 1) return 1;
  return (po - pe) / (1 - pe);
}

/**
 * One-way random ICC(1,1) approximation using case means vs residual variance.
 * Returns null when underpowered.
 */
export function icc1(matrix: number[][]): number | null {
  const n = matrix.length;
  if (n < 2) return null;
  const k = matrix[0]?.length ?? 0;
  if (k < 2) return null;
  const means = matrix.map((row) => mean(row));
  const grand = mean(means);
  const bms =
    (k * means.reduce((s, m) => s + (m - grand) ** 2, 0)) / (n - 1);
  let wss = 0;
  for (const row of matrix) {
    const m = mean(row);
    wss += row.reduce((s, x) => s + (x - m) ** 2, 0);
  }
  const wms = wss / (n * (k - 1));
  const den = bms + (k - 1) * wms;
  if (den === 0) return null;
  return (bms - wms) / den;
}

export function weightedAgreement(
  ratings: ExpertRating[],
  domain: ExpertRatingDomain,
): number | null {
  const subset = ratings.filter((r) => r.domain === domain);
  const byCase = new Map<string, number[]>();
  for (const r of subset) {
    const arr = byCase.get(r.case_key) ?? [];
    arr.push(r.score / Math.max(1, r.scale_max));
    byCase.set(r.case_key, arr);
  }
  const diffs: number[] = [];
  for (const vals of byCase.values()) {
    if (vals.length < 2) continue;
    const m = mean(vals);
    diffs.push(1 - Math.min(1, stdLike(vals, m)));
  }
  if (!diffs.length) return null;
  return clamp01to100(mean(diffs) * 100);
}

function stdLike(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

function pairedRaterBins(
  ratings: ExpertRating[],
  domain: ExpertRatingDomain,
): { a: number[]; b: number[]; matrix: number[][]; nCases: number; nRaters: number } | null {
  const subset = ratings.filter((r) => r.domain === domain);
  const raters = [...new Set(subset.map((r) => r.rater_id))];
  if (raters.length < MIN_RATERS) return null;
  const r0 = raters[0]!;
  const r1 = raters[1]!;
  const byCase = new Map<string, Record<string, number>>();
  for (const r of subset) {
    const row = byCase.get(r.case_key) ?? {};
    row[r.rater_id] = binScore(r.score, r.scale_max);
    byCase.set(r.case_key, row);
  }
  const a: number[] = [];
  const b: number[] = [];
  const matrix: number[][] = [];
  for (const row of byCase.values()) {
    if (row[r0] == null || row[r1] == null) continue;
    a.push(row[r0]!);
    b.push(row[r1]!);
    const full = raters.map((id) => row[id]).filter((x): x is number => x != null);
    if (full.length >= 2) matrix.push(full);
  }
  if (a.length < 2) return null;
  return { a, b, matrix, nCases: a.length, nRaters: raters.length };
}

export function computeInterRater(
  ratings: ExpertRating[],
  domain: ExpertRatingDomain,
): InterRaterResult {
  const paired = pairedRaterBins(ratings, domain);
  const pa = percentAgreement(ratings, domain);
  const wa = weightedAgreement(ratings, domain);
  let kappa: number | null = null;
  let icc: number | null = null;
  let nCases = 0;
  let nRaters = new Set(ratings.filter((r) => r.domain === domain).map((r) => r.rater_id))
    .size;

  if (paired) {
    nCases = paired.nCases;
    nRaters = paired.nRaters;
    kappa = cohenKappa(paired.a, paired.b, 5);
    icc = icc1(paired.matrix);
  }

  const sufficient =
    nRaters >= MIN_RATERS && nCases >= MIN_CASES_FOR_INFERENCE;

  return {
    domain,
    n_raters: nRaters,
    n_cases: nCases,
    percent_agreement: pa == null ? null : Math.round(pa * 10) / 10,
    cohen_kappa:
      kappa == null ? null : Math.round(kappa * 1000) / 1000,
    icc: icc == null ? null : Math.round(icc * 1000) / 1000,
    weighted_agreement: wa == null ? null : Math.round(wa * 10) / 10,
    evidence: [
      `domain=${domain}`,
      `n_raters=${nRaters}`,
      `n_cases=${nCases}`,
      "significance_not_fabricated",
    ],
    sufficient_for_inference: sufficient,
  };
}

export function computeAllInterRater(
  ratings: ExpertRating[],
): InterRaterResult[] {
  const domains = [
    ...new Set(ratings.map((r) => r.domain)),
  ] as ExpertRatingDomain[];
  const results = domains.map((d) => computeInterRater(ratings, d));

  // Aggregate diagnostic / risk / communication if present
  for (const special of [
    "diagnostic_agreement",
    "risk_agreement",
    "communication_agreement",
  ] as ExpertRatingDomain[]) {
    if (!domains.includes(special) && ratings.some((r) => r.domain === special)) {
      results.push(computeInterRater(ratings, special));
    }
  }

  if (results.length) {
    const kappas = results
      .map((r) => r.cohen_kappa)
      .filter((x): x is number => x != null);
    results.push({
      domain: "aggregate",
      n_raters: Math.max(0, ...results.map((r) => r.n_raters)),
      n_cases: Math.max(0, ...results.map((r) => r.n_cases)),
      percent_agreement: mean(
        results
          .map((r) => r.percent_agreement)
          .filter((x): x is number => x != null),
      ),
      cohen_kappa: kappas.length ? mean(kappas) : null,
      icc: mean(
        results.map((r) => r.icc).filter((x): x is number => x != null),
      ),
      weighted_agreement: mean(
        results
          .map((r) => r.weighted_agreement)
          .filter((x): x is number => x != null),
      ),
      evidence: ["aggregate_across_domains"],
      sufficient_for_inference: results.every((r) => r.sufficient_for_inference),
    });
  }

  return results;
}

/** Exported for tests — variance used in ICC path. */
export function ratingVariance(xs: number[]): number {
  return variance(xs);
}

export function ratingPearson(a: number[], b: number[]): number | null {
  return pearson(a, b);
}

/**
 * Assessment reliability statistics.
 *
 * Pure functions — no AI calls, no I/O — so that agreement between the AI
 * examiner and human raters, agreement *among* human raters, and stability
 * across repeated AI runs can all be measured without a provider key and
 * unit-tested like any other module.
 *
 * Why this exists: `assessSession()` produces a score that a training program
 * is expected to treat as meaningful. Nothing in the codebase previously
 * measured whether that score is reproducible or whether it tracks expert
 * judgement. These are the primitives for answering both.
 */

import type { RubricItem, ScoreEntry } from "@/lib/types";

/** One rater's scores across rubric items (`rubric item id` → raw score). */
export type RaterScores = {
  /** Expert initials, "model", "run-3", … */
  raterId: string;
  items: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Canonical scoring
// ---------------------------------------------------------------------------

/**
 * Weighted 0–100 overall score. This is the single source of truth for the
 * formula — `assessSession()` uses it too, so reliability numbers can never
 * drift from the score the platform actually reports.
 */
export function weightedOverallScore(
  items: Pick<ScoreEntry, "score" | "max" | "weight">[],
): number {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0) || 1;
  const sum = items.reduce(
    (s, i) => s + (i.score / i.max) * 100 * (i.weight / totalWeight),
    0,
  );
  return Math.round(sum);
}

/** Overall score for a bare `itemId → score` map, using the rubric's weights. */
export function weightedOverallFromMap(
  scores: Record<string, number>,
  rubric: RubricItem[],
): number {
  return weightedOverallScore(
    rubric.map((r) => ({
      score: scores[r.id] ?? 0,
      max: r.max,
      weight: r.weight,
    })),
  );
}

// ---------------------------------------------------------------------------
// Elementary statistics
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Sample standard deviation (n−1). Returns 0 for fewer than two values. */
export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Pearson correlation. Null when the vectors are too short or either side is
 * constant (correlation is undefined, not zero — reporting 0 would read as
 * "no relationship" when the truth is "not computable").
 */
export function pearson(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    const xa = a[i]! - ma;
    const xb = b[i]! - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

export function meanAbsoluteError(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  return mean(a.map((v, i) => Math.abs(v - b[i]!)));
}

export type KappaWeighting = "none" | "linear" | "quadratic";

/**
 * Cohen's kappa for two raters on an ordinal scale, optionally weighted.
 *
 * Rubric scores are ordinal (0–5), so quadratic weighting is the appropriate
 * default when reporting AI-vs-expert agreement: a 4-vs-5 disagreement should
 * not be penalised like a 1-vs-5 disagreement.
 *
 * Returns null when agreement is not computable (empty input, or expected
 * agreement of exactly 1, which makes the denominator zero).
 */
export function weightedKappa(
  a: number[],
  b: number[],
  opts?: { weighting?: KappaWeighting; min?: number; max?: number },
): number | null {
  if (a.length !== b.length || a.length === 0) return null;

  const weighting = opts?.weighting ?? "quadratic";
  const lo = opts?.min ?? Math.min(...a, ...b);
  const hi = opts?.max ?? Math.max(...a, ...b);
  const categories = Math.round(hi - lo) + 1;
  if (categories < 2) return null;

  const index = (v: number) =>
    Math.min(categories - 1, Math.max(0, Math.round(v - lo)));

  const n = a.length;
  const observed: number[][] = Array.from({ length: categories }, () =>
    new Array<number>(categories).fill(0),
  );
  const rowTotals = new Array<number>(categories).fill(0);
  const colTotals = new Array<number>(categories).fill(0);

  for (let i = 0; i < n; i += 1) {
    const ra = index(a[i]!);
    const rb = index(b[i]!);
    observed[ra]![rb] += 1;
    rowTotals[ra] += 1;
    colTotals[rb] += 1;
  }

  const weight = (i: number, j: number): number => {
    if (weighting === "none") return i === j ? 0 : 1;
    const d = Math.abs(i - j);
    const span = categories - 1;
    return weighting === "linear" ? d / span : (d * d) / (span * span);
  };

  let observedDisagreement = 0;
  let expectedDisagreement = 0;
  for (let i = 0; i < categories; i += 1) {
    for (let j = 0; j < categories; j += 1) {
      const w = weight(i, j);
      observedDisagreement += w * (observed[i]![j]! / n);
      expectedDisagreement += w * ((rowTotals[i]! / n) * (colTotals[j]! / n));
    }
  }

  if (expectedDisagreement === 0) return null;
  return 1 - observedDisagreement / expectedDisagreement;
}

export type IccResult = {
  /** ICC(2,1) — two-way random effects, absolute agreement, single rater. */
  icc: number;
  subjects: number;
  raters: number;
};

/**
 * ICC(2,1): two-way random effects, absolute agreement, single measurement.
 *
 * `matrix[subject][rater]` — e.g. rubric items as subjects and repeated model
 * runs as raters, or calibration cases as subjects and experts as raters.
 *
 * This is the standard reliability coefficient for continuous/ordinal ratings
 * by multiple raters, and the one a training programme's psychometrician will
 * ask for. Conventional reading: <0.5 poor, 0.5–0.75 moderate, 0.75–0.9 good,
 * >0.9 excellent.
 *
 * Returns null when the design is degenerate (fewer than 2 subjects or raters).
 */
export function intraclassCorrelation(matrix: number[][]): IccResult | null {
  const n = matrix.length;
  if (n < 2) return null;
  const k = matrix[0]?.length ?? 0;
  if (k < 2) return null;
  if (matrix.some((row) => row.length !== k)) return null;

  const all = matrix.flat();
  const grand = mean(all);

  const rowMeans = matrix.map((row) => mean(row));
  const colMeans = Array.from({ length: k }, (_, j) =>
    mean(matrix.map((row) => row[j]!)),
  );

  const ssRows = k * rowMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssCols = n * colMeans.reduce((s, m) => s + (m - grand) ** 2, 0);
  const ssTotal = all.reduce((s, v) => s + (v - grand) ** 2, 0);
  const ssError = ssTotal - ssRows - ssCols;

  const msRows = ssRows / (n - 1);
  const msCols = ssCols / (k - 1);
  const msError = ssError / ((n - 1) * (k - 1));

  const denominator =
    msRows + (k - 1) * msError + (k * (msCols - msError)) / n;
  if (denominator === 0) return null;

  return {
    icc: (msRows - msError) / denominator,
    subjects: n,
    raters: k,
  };
}

// ---------------------------------------------------------------------------
// Agreement between two raters (typically expert consensus vs the model)
// ---------------------------------------------------------------------------

export type ItemAgreement = {
  itemId: string;
  reference: number;
  candidate: number;
  absoluteError: number;
  exact: boolean;
  /** Adjacent agreement — the usual bar for ordinal clinical rating scales. */
  withinOnePoint: boolean;
};

export type AgreementReport = {
  items: ItemAgreement[];
  meanAbsoluteError: number;
  /** Proportion of items scored identically. */
  exactAgreement: number;
  /** Proportion of items within one scale point. */
  adjacentAgreement: number;
  pearson: number | null;
  quadraticWeightedKappa: number | null;
  overall: { reference: number; candidate: number; absoluteError: number };
};

/**
 * Compare a candidate rating (usually the model) against a reference rating
 * (usually expert consensus) across the rubric.
 */
export function agreementBetween(params: {
  reference: Record<string, number>;
  candidate: Record<string, number>;
  rubric: RubricItem[];
}): AgreementReport {
  const { reference, candidate, rubric } = params;

  const items: ItemAgreement[] = rubric.map((r) => {
    const ref = reference[r.id] ?? 0;
    const cand = candidate[r.id] ?? 0;
    const absoluteError = Math.abs(ref - cand);
    return {
      itemId: r.id,
      reference: ref,
      candidate: cand,
      absoluteError,
      exact: absoluteError === 0,
      withinOnePoint: absoluteError <= 1,
    };
  });

  const refVector = items.map((i) => i.reference);
  const candVector = items.map((i) => i.candidate);
  const maxScale = Math.max(...rubric.map((r) => r.max), 1);

  const referenceOverall = weightedOverallFromMap(reference, rubric);
  const candidateOverall = weightedOverallFromMap(candidate, rubric);

  return {
    items,
    meanAbsoluteError: meanAbsoluteError(refVector, candVector),
    exactAgreement: items.length
      ? items.filter((i) => i.exact).length / items.length
      : 0,
    adjacentAgreement: items.length
      ? items.filter((i) => i.withinOnePoint).length / items.length
      : 0,
    pearson: pearson(refVector, candVector),
    quadraticWeightedKappa: weightedKappa(refVector, candVector, {
      weighting: "quadratic",
      min: 0,
      max: maxScale,
    }),
    overall: {
      reference: referenceOverall,
      candidate: candidateOverall,
      absoluteError: Math.abs(referenceOverall - candidateOverall),
    },
  };
}

// ---------------------------------------------------------------------------
// Stability of the model across repeated runs of the same transcript
// ---------------------------------------------------------------------------

export type ItemStability = {
  itemId: string;
  mean: number;
  sd: number;
  min: number;
  max: number;
  range: number;
};

export type SelfConsistencyReport = {
  runs: number;
  items: ItemStability[];
  /** SD of the worst-behaved rubric line — the number that should worry you. */
  maxItemSd: number;
  overall: {
    mean: number;
    sd: number;
    min: number;
    max: number;
    range: number;
  };
  /** ICC(2,1) treating rubric items as subjects and runs as raters. */
  icc: IccResult | null;
};

/**
 * Measure how much the grader's own output moves when the same transcript is
 * scored repeatedly. A grader that cannot reproduce its own score cannot be
 * agreeing with an expert except by luck, so this runs first.
 */
export function selfConsistency(params: {
  runs: Record<string, number>[];
  rubric: RubricItem[];
}): SelfConsistencyReport {
  const { runs, rubric } = params;

  const items: ItemStability[] = rubric.map((r) => {
    const values = runs.map((run) => run[r.id] ?? 0);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    return {
      itemId: r.id,
      mean: mean(values),
      sd: standardDeviation(values),
      min,
      max,
      range: max - min,
    };
  });

  const overallScores = runs.map((run) => weightedOverallFromMap(run, rubric));
  const overallMin = overallScores.length ? Math.min(...overallScores) : 0;
  const overallMax = overallScores.length ? Math.max(...overallScores) : 0;

  // matrix[item][run]
  const matrix = rubric.map((r) => runs.map((run) => run[r.id] ?? 0));

  return {
    runs: runs.length,
    items,
    maxItemSd: items.reduce((m, i) => Math.max(m, i.sd), 0),
    overall: {
      mean: mean(overallScores),
      sd: standardDeviation(overallScores),
      min: overallMin,
      max: overallMax,
      range: overallMax - overallMin,
    },
    icc: intraclassCorrelation(matrix),
  };
}

// ---------------------------------------------------------------------------
// Agreement among human raters
// ---------------------------------------------------------------------------

/**
 * Mean score per rubric item across experts — the reference the model is
 * compared against.
 */
export function expertConsensus(
  ratings: RaterScores[],
  rubric: RubricItem[],
): Record<string, number> {
  const consensus: Record<string, number> = {};
  for (const r of rubric) {
    consensus[r.id] = mean(ratings.map((rating) => rating.items[r.id] ?? 0));
  }
  return consensus;
}

/**
 * Inter-rater reliability among the human experts themselves.
 *
 * Report this next to any AI-vs-expert number. If the experts do not agree with
 * each other, "the AI disagrees with the expert" is not a finding about the AI —
 * it is a finding about the rubric.
 */
export function interRaterReliability(
  ratings: RaterScores[],
  rubric: RubricItem[],
): IccResult | null {
  if (ratings.length < 2) return null;
  // matrix[item][rater]
  const matrix = rubric.map((r) =>
    ratings.map((rating) => rating.items[r.id] ?? 0),
  );
  return intraclassCorrelation(matrix);
}

/** Conventional qualitative band for an ICC or kappa coefficient. */
export function reliabilityBand(
  coefficient: number | null,
): "not computable" | "poor" | "moderate" | "good" | "excellent" {
  if (coefficient === null || Number.isNaN(coefficient)) return "not computable";
  if (coefficient < 0.5) return "poor";
  if (coefficient < 0.75) return "moderate";
  if (coefficient < 0.9) return "good";
  return "excellent";
}

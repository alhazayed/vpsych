/**
 * Psychometric helpers for simulated / offline score series (Mission 19).
 */

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

/** Cronbach's alpha for items × subjects matrix (rows=subjects, cols=items). */
export function cronbachAlpha(matrix: number[][]): number | null {
  const n = matrix.length;
  if (n < 2) return null;
  const k = matrix[0]?.length ?? 0;
  if (k < 2) return null;
  const itemVars: number[] = [];
  for (let j = 0; j < k; j++) {
    const col = matrix.map((row) => row[j] ?? 0);
    itemVars.push(variance(col));
  }
  const totals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const totalVar = variance(totals);
  if (totalVar === 0) return null;
  const sumItemVar = itemVars.reduce((a, b) => a + b, 0);
  return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}

/** Pearson correlation */
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

export type PsychometricSummary = {
  n_scores: number;
  mean: number;
  sd: number;
  min: number;
  max: number;
  cronbach_alpha: number | null;
  test_retest_r: number | null;
  discrimination_index: number | null;
};

/**
 * Mean CORRECTED item–total discrimination across items.
 *
 * For each item, correlate that item against the sum of the OTHER items
 * (rest-score), then average across items. Rows = subjects, cols = items —
 * the same orientation `cronbachAlpha` documents.
 *
 * The corrected (rest-score) form is required. A previous implementation
 * correlated each subject's item MEAN against that subject's TOTAL; since
 * total = k x mean, that returns exactly 1 for any input and never varies by
 * item. It read as perfect discrimination and awarded the Assessment Validity
 * Index its full discrimination band unconditionally. See F-FIND-2 in
 * `docs/VPsych_MASTER_EXECUTION_LEDGER.md`.
 */
export function itemTotalDiscrimination(itemsMatrix: number[][]): number | null {
  const n = itemsMatrix.length;
  if (n < 2) return null;
  const k = itemsMatrix[0]?.length ?? 0;
  if (k < 2) return null;

  const perItem: number[] = [];
  for (let j = 0; j < k; j++) {
    const column = itemsMatrix.map((row) => row[j] ?? 0);
    const restScores = itemsMatrix.map((row) =>
      row.reduce((acc, value, i) => (i === j ? acc : acc + value), 0),
    );
    const r = pearson(column, restScores);
    if (r != null) perItem.push(r);
  }
  return perItem.length ? mean(perItem) : null;
}

export function summarizePsychometrics(input: {
  overalls: number[];
  itemMatrix: number[][];
  retestOveralls?: number[];
}): PsychometricSummary {
  const overalls = input.overalls;
  const alpha = cronbachAlpha(input.itemMatrix);
  const retest =
    input.retestOveralls && input.retestOveralls.length === overalls.length
      ? pearson(overalls, input.retestOveralls)
      : null;
  const disc = itemTotalDiscrimination(input.itemMatrix);
  return {
    n_scores: overalls.length,
    mean: Math.round(mean(overalls) * 10) / 10,
    sd: Math.round(stddev(overalls) * 10) / 10,
    min: overalls.length ? Math.min(...overalls) : 0,
    max: overalls.length ? Math.max(...overalls) : 0,
    cronbach_alpha: alpha == null ? null : Math.round(alpha * 1000) / 1000,
    test_retest_r: retest == null ? null : Math.round(retest * 1000) / 1000,
    discrimination_index: disc == null ? null : Math.round(disc * 1000) / 1000,
  };
}

import { describe, expect, it } from "vitest";

import {
  cronbachAlpha,
  itemTotalDiscrimination,
  summarizePsychometrics,
} from "@/lib/scientific/psychometrics";

/**
 * Regression cover for F-FIND-2.
 *
 * The previous implementation correlated each subject's item MEAN against that
 * subject's TOTAL. Because total = k x mean, it returned exactly 1 for any
 * input and never varied by item — it read as perfect discrimination and
 * awarded the Assessment Validity Index its full +20 band unconditionally.
 */

/** rows = subjects, cols = items — the orientation cronbachAlpha documents. */
const COHERENT = [
  [5, 4, 5, 4],
  [2, 1, 2, 2],
  [4, 5, 4, 3],
  [1, 2, 1, 1],
  [3, 3, 4, 4],
  [5, 5, 5, 4],
];

describe("itemTotalDiscrimination — corrected item-total correlation", () => {
  it("is NOT 1 by construction on a real matrix", () => {
    const d = itemTotalDiscrimination(COHERENT)!;
    expect(d).not.toBe(1);
    expect(Math.abs(d)).toBeLessThan(1);
  });

  it("is high but sub-1 when items are coherent", () => {
    const d = itemTotalDiscrimination(COHERENT)!;
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(1);
  });

  it("drops when an item is discordant", () => {
    const coherent = itemTotalDiscrimination(COHERENT)!;
    // Replace the last column with values that move against the others.
    const withNoise = COHERENT.map((row, i) => [...row.slice(0, 3), [1, 5, 1, 5, 1, 2][i]!]);
    const noisy = itemTotalDiscrimination(withNoise)!;
    expect(noisy).toBeLessThan(coherent);
  });

  it("returns null when the matrix cannot support the statistic", () => {
    expect(itemTotalDiscrimination([])).toBeNull();
    expect(itemTotalDiscrimination([[1, 2, 3]])).toBeNull();
    expect(itemTotalDiscrimination([[1], [2], [3]])).toBeNull();
  });

  it("returns null rather than a number when every item is constant", () => {
    expect(
      itemTotalDiscrimination([
        [3, 3, 3],
        [3, 3, 3],
        [3, 3, 3],
      ]),
    ).toBeNull();
  });
});

describe("summarizePsychometrics", () => {
  it("no longer reports a discrimination index of exactly 1", () => {
    const totals = COHERENT.map((r) => r.reduce((a, b) => a + b, 0));
    const summary = summarizePsychometrics({ overalls: totals, itemMatrix: COHERENT });
    expect(summary.discrimination_index).not.toBe(1);
    expect(summary.cronbach_alpha).not.toBeNull();
  });

  it("still computes alpha unchanged", () => {
    const totals = COHERENT.map((r) => r.reduce((a, b) => a + b, 0));
    const summary = summarizePsychometrics({ overalls: totals, itemMatrix: COHERENT });
    const direct = cronbachAlpha(COHERENT)!;
    expect(summary.cronbach_alpha).toBeCloseTo(Math.round(direct * 1000) / 1000, 5);
  });
});

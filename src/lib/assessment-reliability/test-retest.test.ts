import { describe, expect, it } from "vitest";

import {
  MIN_OCCASIONS,
  computeTestRetestReport,
  type ScoringOccasion,
} from "@/lib/assessment-reliability/test-retest";

const ITEMS = ["alliance", "assessment", "risk"] as const;

function occasion(
  session_id: string,
  occ: number,
  scores: number[],
  extra: Partial<ScoringOccasion> = {},
): ScoringOccasion {
  return {
    session_id,
    occasion: occ,
    overall: (scores.reduce((a, b) => a + b, 0) / (scores.length * 5)) * 100,
    items: ITEMS.map((id, i) => ({ id, score: scores[i]!, max: 5 })),
    ai_model: "gpt-5-2025-08-07",
    prompt_engine_version: "2.0.0",
    assessment_mode: "llm_examiner",
    ...extra,
  };
}

describe("test–retest harness", () => {
  it("blocks on a single occasion rather than reporting a number", () => {
    const report = computeTestRetestReport([
      occasion("s1", 1, [3, 4, 2]),
      occasion("s2", 1, [4, 4, 3]),
    ]);
    expect(report.n_occasions).toBe(1);
    expect(report.overall_r).toBeNull();
    expect(report.blocking.length).toBeGreaterThan(0);
    expect(report.blocking.join(" ")).toMatch(
      new RegExp(`Fewer than ${MIN_OCCASIONS} distinct scoring occasions`),
    );
  });

  it("reports perfect stability when re-scoring is identical", () => {
    const report = computeTestRetestReport([
      occasion("s1", 1, [3, 4, 2]),
      occasion("s1", 2, [3, 4, 2]),
      occasion("s2", 1, [5, 2, 4]),
      occasion("s2", 2, [5, 2, 4]),
      occasion("s3", 1, [1, 3, 5]),
      occasion("s3", 2, [1, 3, 5]),
    ]);
    expect(report.blocking).toEqual([]);
    expect(report.overall_r).toBe(1);
    expect(report.overall_mean_absolute_difference).toBe(0);
    expect(report.standard_error_of_measurement).toBe(0);
    for (const item of report.items) {
      expect(item.exact_agreement_rate).toBe(1);
      expect(item.max_absolute_difference).toBe(0);
    }
  });

  it("detects instability and localises it to the drifting item", () => {
    // `risk` moves on every session; the other two are stable.
    const report = computeTestRetestReport([
      occasion("s1", 1, [3, 4, 2]),
      occasion("s1", 2, [3, 4, 4]),
      occasion("s2", 1, [5, 2, 4]),
      occasion("s2", 2, [5, 2, 1]),
      occasion("s3", 1, [1, 3, 5]),
      occasion("s3", 2, [1, 3, 3]),
    ]);
    const byId = Object.fromEntries(report.items.map((i) => [i.id, i]));
    expect(byId.alliance!.exact_agreement_rate).toBe(1);
    expect(byId.assessment!.exact_agreement_rate).toBe(1);
    expect(byId.risk!.exact_agreement_rate).toBe(0);
    expect(byId.risk!.max_absolute_difference).toBe(3);
    expect(report.overall_mean_absolute_difference).toBeGreaterThan(0);
  });

  it("excludes a session missing a run instead of filling it in", () => {
    const report = computeTestRetestReport([
      occasion("s1", 1, [3, 4, 2]),
      occasion("s1", 2, [3, 4, 2]),
      occasion("s2", 1, [5, 2, 4]),
      occasion("s2", 2, [5, 2, 4]),
      occasion("s3", 1, [1, 3, 5]), // no second run
    ]);
    expect(report.n_sessions).toBe(2);
    expect(report.limitations.join(" ")).toMatch(
      /1 session\(s\) were not scored on every occasion/,
    );
  });

  it("never returns an empty limitations list", () => {
    const report = computeTestRetestReport([
      occasion("s1", 1, [3, 4, 2]),
      occasion("s1", 2, [3, 4, 2]),
      occasion("s2", 1, [5, 2, 4]),
      occasion("s2", 2, [5, 2, 4]),
    ]);
    expect(report.limitations.length).toBeGreaterThanOrEqual(3);
    expect(report.limitations.join(" ")).toMatch(/reproducibility, not validity/);
  });

  it("flags occasions that span different configurations", () => {
    const report = computeTestRetestReport([
      occasion("s1", 1, [3, 4, 2]),
      occasion("s1", 2, [3, 4, 2], { ai_model: "gpt-4o" }),
      occasion("s2", 1, [5, 2, 4]),
      occasion("s2", 2, [5, 2, 4], { ai_model: "gpt-4o" }),
    ]);
    expect(report.limitations.join(" ")).toMatch(
      /measures configuration change, not test–retest/,
    );
  });

  it("flags heuristic-fallback occasions, which are deterministic and inflate stability", () => {
    const report = computeTestRetestReport([
      occasion("s1", 1, [3, 4, 2]),
      occasion("s1", 2, [3, 4, 2], {
        assessment_mode: "heuristic_fallback",
        ai_model: null,
      }),
      occasion("s2", 1, [5, 2, 4]),
      occasion("s2", 2, [5, 2, 4]),
    ]);
    expect(report.limitations.join(" ")).toMatch(/HEURISTIC KEYWORD FALLBACK/);
    expect(report.limitations.join(" ")).toMatch(/inflates apparent stability/);
  });

  it("returns null SEM rather than 0 when the correlation is negative", () => {
    // Deliberately anti-correlated re-scoring: sqrt(1 - r) is fine, but a
    // negative r means the sample carries no usable precision estimate, and
    // reporting 0 would read as perfect measurement.
    const report = computeTestRetestReport([
      occasion("s1", 1, [1, 1, 1]),
      occasion("s1", 2, [5, 5, 5]),
      occasion("s2", 1, [5, 5, 5]),
      occasion("s2", 2, [1, 1, 1]),
      occasion("s3", 1, [2, 2, 2]),
      occasion("s3", 2, [4, 4, 4]),
    ]);
    expect(report.overall_r).toBeLessThan(0);
    expect(report.standard_error_of_measurement).toBeNull();
  });
});

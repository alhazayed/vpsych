import { describe, expect, it } from "vitest";
import {
  agreementBetween,
  expertConsensus,
  interRaterReliability,
  intraclassCorrelation,
  meanAbsoluteError,
  pearson,
  reliabilityBand,
  selfConsistency,
  standardDeviation,
  weightedKappa,
  weightedOverallFromMap,
  weightedOverallScore,
} from "@/lib/ai/reliability";
import type { RubricItem } from "@/lib/types";

const RUBRIC: RubricItem[] = [
  { id: "alliance", label: "Therapeutic alliance", weight: 25, max: 5 },
  { id: "assessment", label: "Assessment", weight: 25, max: 5 },
  { id: "interventions", label: "Interventions", weight: 20, max: 5 },
  { id: "safety", label: "Risk & safety", weight: 20, max: 5 },
  { id: "structure", label: "Session structure", weight: 10, max: 5 },
];

const flat = (score: number): Record<string, number> =>
  Object.fromEntries(RUBRIC.map((r) => [r.id, score]));

describe("weightedOverallScore", () => {
  it("matches the formula the session report uses", () => {
    expect(weightedOverallScore(RUBRIC.map((r) => ({ ...r, score: 5 })))).toBe(
      100,
    );
    expect(weightedOverallScore(RUBRIC.map((r) => ({ ...r, score: 0 })))).toBe(0);
    expect(weightedOverallScore(RUBRIC.map((r) => ({ ...r, score: 3 })))).toBe(60);
  });

  it("weights each rubric line by its declared weight", () => {
    const onlyAlliance = RUBRIC.map((r) => ({
      ...r,
      score: r.id === "alliance" ? 5 : 0,
    }));
    // alliance carries 25 of 100 weight at full marks.
    expect(weightedOverallScore(onlyAlliance)).toBe(25);
  });

  it("reads the same scores from a bare item→score map", () => {
    expect(weightedOverallFromMap(flat(4), RUBRIC)).toBe(80);
    expect(weightedOverallFromMap({}, RUBRIC)).toBe(0);
  });
});

describe("elementary statistics", () => {
  it("computes sample standard deviation", () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(standardDeviation([3, 3, 3])).toBe(0);
    expect(standardDeviation([3])).toBe(0);
  });

  it("computes Pearson correlation and refuses undefined cases", () => {
    expect(pearson([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
    // A constant vector has zero variance — correlation is undefined, not zero.
    expect(pearson([2, 2, 2, 2], [1, 2, 3, 4])).toBeNull();
    expect(pearson([1, 2], [1])).toBeNull();
  });

  it("computes mean absolute error", () => {
    expect(meanAbsoluteError([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(meanAbsoluteError([1, 2, 3], [2, 4, 6])).toBeCloseTo(2, 10);
  });
});

describe("weightedKappa", () => {
  it("returns 1 for perfect agreement", () => {
    expect(
      weightedKappa([1, 2, 3, 4], [1, 2, 3, 4], { min: 0, max: 5 }),
    ).toBeCloseTo(1, 10);
  });

  it("returns 0 when agreement is exactly what chance predicts", () => {
    // 2x2 fully crossed: observed disagreement equals expected disagreement.
    expect(
      weightedKappa([0, 0, 1, 1], [0, 1, 0, 1], {
        weighting: "none",
        min: 0,
        max: 1,
      }),
    ).toBeCloseTo(0, 10);
  });

  it("penalises distant disagreement more than adjacent disagreement", () => {
    const adjacent = weightedKappa([1, 2, 3, 4], [2, 3, 4, 5], {
      weighting: "quadratic",
      min: 0,
      max: 5,
    });
    const distant = weightedKappa([1, 2, 3, 4], [5, 4, 3, 2], {
      weighting: "quadratic",
      min: 0,
      max: 5,
    });
    expect(adjacent).not.toBeNull();
    expect(distant).not.toBeNull();
    expect(adjacent!).toBeGreaterThan(distant!);
  });

  it("is not computable for a single category or empty input", () => {
    expect(weightedKappa([3, 3, 3], [3, 3, 3], { min: 3, max: 3 })).toBeNull();
    expect(weightedKappa([], [])).toBeNull();
  });
});

describe("intraclassCorrelation (ICC 2,1)", () => {
  it("is 1 when raters agree exactly", () => {
    const result = intraclassCorrelation([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ]);
    expect(result).not.toBeNull();
    expect(result!.icc).toBeCloseTo(1, 10);
    expect(result!.subjects).toBe(4);
    expect(result!.raters).toBe(2);
  });

  it("drops below 1 for a systematic one-point rater bias", () => {
    // Absolute-agreement ICC must punish a rater who is consistently generous,
    // even though the two raters correlate perfectly.
    const result = intraclassCorrelation([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ]);
    expect(result).not.toBeNull();
    expect(result!.icc).toBeCloseTo(0.769, 3);
    expect(pearson([1, 2, 3, 4], [2, 3, 4, 5])).toBeCloseTo(1, 10);
  });

  it("rejects degenerate designs", () => {
    expect(intraclassCorrelation([[1, 2]])).toBeNull();
    expect(intraclassCorrelation([[1], [2], [3]])).toBeNull();
    expect(intraclassCorrelation([[1, 2], [3]])).toBeNull();
  });
});

describe("agreementBetween", () => {
  it("reports exact and adjacent agreement per rubric item", () => {
    const report = agreementBetween({
      reference: {
        alliance: 4,
        assessment: 3,
        interventions: 3,
        safety: 5,
        structure: 2,
      },
      candidate: {
        alliance: 4,
        assessment: 4,
        interventions: 1,
        safety: 5,
        structure: 2,
      },
      rubric: RUBRIC,
    });

    expect(report.items).toHaveLength(5);
    // 3 of 5 exact (alliance, safety, structure).
    expect(report.exactAgreement).toBeCloseTo(0.6, 10);
    // interventions is off by 2, so 4 of 5 are within one point.
    expect(report.adjacentAgreement).toBeCloseTo(0.8, 10);
    expect(report.meanAbsoluteError).toBeCloseTo(0.6, 10);

    const interventions = report.items.find((i) => i.itemId === "interventions");
    expect(interventions?.absoluteError).toBe(2);
    expect(interventions?.withinOnePoint).toBe(false);
  });

  it("surfaces the gap between the two overall scores", () => {
    const report = agreementBetween({
      reference: flat(4),
      candidate: flat(3),
      rubric: RUBRIC,
    });
    expect(report.overall.reference).toBe(80);
    expect(report.overall.candidate).toBe(60);
    expect(report.overall.absoluteError).toBe(20);
  });

  it("treats a missing rubric item as zero rather than dropping it", () => {
    const report = agreementBetween({
      reference: flat(3),
      candidate: { alliance: 3 },
      rubric: RUBRIC,
    });
    expect(report.items).toHaveLength(5);
    expect(report.items.filter((i) => i.candidate === 0)).toHaveLength(4);
  });
});

describe("selfConsistency", () => {
  it("reports zero spread when the grader reproduces itself", () => {
    const report = selfConsistency({
      runs: [flat(4), flat(4), flat(4)],
      rubric: RUBRIC,
    });
    expect(report.runs).toBe(3);
    expect(report.maxItemSd).toBe(0);
    expect(report.overall.sd).toBe(0);
    expect(report.overall.range).toBe(0);
    expect(report.overall.mean).toBe(80);
  });

  it("surfaces the worst-behaved rubric line", () => {
    const report = selfConsistency({
      runs: [
        { ...flat(4), safety: 1 },
        { ...flat(4), safety: 5 },
        { ...flat(4), safety: 3 },
      ],
      rubric: RUBRIC,
    });
    const safety = report.items.find((i) => i.itemId === "safety");
    expect(safety?.range).toBe(4);
    expect(report.maxItemSd).toBeCloseTo(safety!.sd, 10);
    expect(report.overall.range).toBeGreaterThan(0);
  });

  it("still returns a report for a single run, with no ICC", () => {
    const report = selfConsistency({ runs: [flat(3)], rubric: RUBRIC });
    expect(report.runs).toBe(1);
    expect(report.overall.sd).toBe(0);
    expect(report.icc).toBeNull();
  });
});

describe("expert ratings", () => {
  it("averages experts into a consensus reference", () => {
    const consensus = expertConsensus(
      [
        { raterId: "AB", items: { ...flat(4), safety: 5 } },
        { raterId: "CD", items: { ...flat(2), safety: 3 } },
      ],
      RUBRIC,
    );
    expect(consensus.alliance).toBeCloseTo(3, 10);
    expect(consensus.safety).toBeCloseTo(4, 10);
  });

  it("measures whether the experts agree with each other at all", () => {
    const agreeing = interRaterReliability(
      [
        { raterId: "AB", items: { ...flat(3), safety: 5, structure: 1 } },
        { raterId: "CD", items: { ...flat(3), safety: 5, structure: 1 } },
      ],
      RUBRIC,
    );
    expect(agreeing).not.toBeNull();
    expect(agreeing!.icc).toBeCloseTo(1, 10);

    expect(interRaterReliability([{ raterId: "AB", items: flat(3) }], RUBRIC))
      .toBeNull();
  });

  it("bands coefficients the way reliability conventions read them", () => {
    expect(reliabilityBand(null)).toBe("not computable");
    expect(reliabilityBand(Number.NaN)).toBe("not computable");
    expect(reliabilityBand(0.3)).toBe("poor");
    expect(reliabilityBand(0.6)).toBe("moderate");
    expect(reliabilityBand(0.8)).toBe("good");
    expect(reliabilityBand(0.95)).toBe("excellent");
  });
});

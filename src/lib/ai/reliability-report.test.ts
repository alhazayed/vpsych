import { describe, expect, it } from "vitest";
import {
  renderReliabilityReport,
  summarizeCase,
  summarizeCorpus,
  type CaseRun,
} from "@/lib/ai/reliability-report";
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

function caseRun(overrides: Partial<CaseRun> = {}): CaseRun {
  return {
    caseId: "CASE-1",
    language: "en",
    rubric: RUBRIC,
    consensus: flat(4),
    consensusOverall: 80,
    interRater: null,
    modelRuns: [flat(4), flat(4), flat(4)],
    aiSources: ["gpt", "gpt", "gpt"],
    ...overrides,
  };
}

describe("summarizeCase", () => {
  it("reports perfect stability and agreement for an ideal grader", () => {
    const summary = summarizeCase(caseRun());
    expect(summary.stability.maxItemSd).toBe(0);
    expect(summary.agreement.exactAgreement).toBe(1);
    expect(summary.agreement.overall.absoluteError).toBe(0);
    expect(summary.heuristicRuns).toBe(0);
  });

  it("compares expert consensus against the mean of the model runs", () => {
    // Runs of 2 and 4 average to 3 — one point below the expert consensus.
    const summary = summarizeCase(
      caseRun({ modelRuns: [flat(2), flat(4)], aiSources: ["gpt", "gpt"] }),
    );
    expect(summary.agreement.meanAbsoluteError).toBeCloseTo(1, 10);
    expect(summary.agreement.overall.candidate).toBe(60);
    expect(summary.agreement.overall.reference).toBe(80);
  });

  it("counts heuristic fallbacks separately from model runs", () => {
    const summary = summarizeCase(
      caseRun({ aiSources: ["gpt", "persona_fallback", "persona_fallback"] }),
    );
    expect(summary.heuristicRuns).toBe(2);
  });
});

describe("summarizeCorpus", () => {
  it("pools every (case, item) pair into one expert-vs-model coefficient", () => {
    const summary = summarizeCorpus([
      caseRun({
        caseId: "A",
        consensus: { ...flat(4), safety: 1 },
        modelRuns: [{ ...flat(4), safety: 1 }],
        aiSources: ["gpt"],
      }),
      caseRun({
        caseId: "B",
        consensus: { ...flat(2), structure: 5 },
        modelRuns: [{ ...flat(2), structure: 5 }],
        aiSources: ["gpt"],
      }),
    ]);

    expect(summary.modelVsExpert).not.toBeNull();
    expect(summary.modelVsExpert!.icc).toBeCloseTo(1, 10);
    expect(summary.modelVsExpert!.subjects).toBe(10);
    expect(summary.exactAgreement).toBe(1);
    expect(summary.meanAbsoluteError).toBe(0);
  });

  it("surfaces the worst instability anywhere in the corpus", () => {
    const summary = summarizeCorpus([
      caseRun({ caseId: "steady" }),
      caseRun({
        caseId: "volatile",
        modelRuns: [
          { ...flat(4), safety: 1 },
          { ...flat(4), safety: 5 },
        ],
        aiSources: ["gpt", "gpt"],
      }),
    ]);

    expect(summary.worstItemSd).toBeGreaterThan(0);
    expect(summary.worstOverallRange).toBeGreaterThan(0);
    expect(summary.totalRuns).toBe(5);
  });

  it("counts heuristic runs across the whole corpus", () => {
    const summary = summarizeCorpus([
      caseRun({ aiSources: ["gpt", "persona_fallback", "gpt"] }),
      caseRun({ caseId: "B", aiSources: ["persona_fallback", "gpt", "gpt"] }),
    ]);
    expect(summary.heuristicRuns).toBe(2);
    expect(summary.totalRuns).toBe(6);
  });

  it("handles an empty corpus without throwing", () => {
    const summary = summarizeCorpus([]);
    expect(summary.cases).toEqual([]);
    expect(summary.modelVsExpert).toBeNull();
    expect(summary.totalRuns).toBe(0);
  });
});

describe("renderReliabilityReport", () => {
  it("says so plainly when nothing was scored", () => {
    expect(renderReliabilityReport(summarizeCorpus([]))).toMatch(
      /No calibration cases were scored/,
    );
  });

  it("reports stability, agreement and per-case detail", () => {
    const text = renderReliabilityReport(
      summarizeCorpus([caseRun({ caseId: "VPSY-CAL-001" })]),
    );
    expect(text).toMatch(/Stability \(same transcript, repeated runs\)/);
    expect(text).toMatch(/Agreement with expert consensus/);
    expect(text).toMatch(/VPSY-CAL-001 \[en\]/);
    expect(text).toMatch(/expert 80 vs model 80/);
  });

  it("warns loudly when runs fell back to the heuristic scorer", () => {
    const text = renderReliabilityReport(
      summarizeCorpus([
        caseRun({ aiSources: ["persona_fallback", "gpt", "gpt"] }),
      ]),
    );
    expect(text).toMatch(/WARNING: 1 run\(s\) fell back to the heuristic/);
  });

  it("names the rubric line with the largest expert-model gap", () => {
    const text = renderReliabilityReport(
      summarizeCorpus([
        caseRun({
          consensus: { ...flat(4), safety: 5 },
          modelRuns: [{ ...flat(4), safety: 1 }],
          aiSources: ["gpt"],
        }),
      ]),
    );
    expect(text).toMatch(/largest gap: safety — expert 5, model 1/);
  });
});

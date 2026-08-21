import { describe, expect, it } from "vitest";

import {
  MIN_SUBJECTS_FOR_ALPHA,
  computeReliabilityReport,
  filterToConfiguration,
  subjectFromStoredReport,
  subjectsFromStoredReports,
  withCompleteProvenance,
  type ReliabilitySubject,
} from "@/lib/assessment-reliability";

const DIMENSIONS = [
  "alliance",
  "assessment",
  "dsm_reasoning",
  "icd_reasoning",
  "clinical_formulation",
] as const;

function subject(
  scores: number[],
  overall: number,
  provenance?: { model?: string; prompt?: string },
): ReliabilitySubject {
  return {
    session_id: `s-${scores.join("")}`,
    overall,
    items: DIMENSIONS.map((id, i) => ({
      id,
      score: scores[i]!,
      max: 5,
      weight: 10,
    })),
    ai_model: provenance?.model ?? null,
    prompt_engine_version: provenance?.prompt ?? null,
  };
}

/** Deterministic, varied sample — consistent responders plus a discordant item. */
const SAMPLE: ReliabilitySubject[] = [
  subject([5, 5, 4, 5, 4], 92, { model: "gpt-5", prompt: "1.0.0" }),
  subject([2, 1, 2, 2, 5], 38, { model: "gpt-5", prompt: "1.0.0" }),
  subject([4, 4, 5, 4, 1], 80, { model: "gpt-5", prompt: "1.0.0" }),
  subject([1, 2, 1, 1, 4], 26, { model: "gpt-5", prompt: "1.0.0" }),
  subject([3, 3, 3, 4, 2], 62, { model: "gpt-5", prompt: "1.0.0" }),
  subject([5, 4, 5, 5, 3], 90, { model: "gpt-5", prompt: "1.0.0" }),
];

describe("computeReliabilityReport", () => {
  it("computes alpha over a homogeneous sample and reports it reproducibly", () => {
    const a = computeReliabilityReport(SAMPLE, () => new Date("2026-01-01T00:00:00Z"));
    const b = computeReliabilityReport(SAMPLE, () => new Date("2026-01-01T00:00:00Z"));

    expect(a.cronbach_alpha).not.toBeNull();
    expect(a.blocking).toEqual([]);
    // Same input must produce byte-identical output — the harness itself must
    // not be a source of variance.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("reports per-item statistics for every common dimension", () => {
    const report = computeReliabilityReport(SAMPLE);
    expect(report.dimensions).toEqual([...DIMENSIONS]);
    expect(report.items).toHaveLength(DIMENSIONS.length);
    for (const item of report.items) {
      expect(item.n).toBe(SAMPLE.length);
      expect(item.corrected_item_total_r).not.toBeNull();
      expect(item.alpha_if_dropped).not.toBeNull();
    }
  });

  it("uses a CORRECTED item-total correlation, so it is not 1 by construction", () => {
    const report = computeReliabilityReport(SAMPLE);
    // The degenerate form (per-subject mean vs per-subject total) returns exactly 1.
    // A corrected item-total correlation must not.
    for (const item of report.items) {
      expect(Math.abs(item.corrected_item_total_r!)).toBeLessThan(1);
    }
  });

  it("detects a discordant item as low or negative discrimination", () => {
    const report = computeReliabilityReport(SAMPLE);
    const discordant = report.items.find((i) => i.id === "clinical_formulation")!;
    const coherent = report.items.find((i) => i.id === "alliance")!;
    // clinical_formulation was authored to move against the others.
    expect(discordant.corrected_item_total_r!).toBeLessThan(
      coherent.corrected_item_total_r!,
    );
    // Dropping a discordant item should raise alpha.
    expect(discordant.alpha_if_dropped!).toBeGreaterThan(report.cronbach_alpha!);
  });

  it("blocks rather than reporting a number when the sample is too small", () => {
    const report = computeReliabilityReport(SAMPLE.slice(0, MIN_SUBJECTS_FOR_ALPHA - 1));
    expect(report.cronbach_alpha).toBeNull();
    expect(report.blocking.length).toBeGreaterThan(0);
  });

  it("blocks when fewer than two dimensions are common to every subject", () => {
    const mismatched: ReliabilitySubject[] = [
      { overall: 50, items: [{ id: "alliance", score: 3, max: 5, weight: 10 }] },
      { overall: 60, items: [{ id: "safety", score: 4, max: 5, weight: 10 }] },
    ];
    const report = computeReliabilityReport(mismatched);
    expect(report.cronbach_alpha).toBeNull();
    expect(report.blocking.join(" ")).toMatch(/2 dimensions/);
  });

  it("excludes a dimension that is missing from any subject rather than zero-filling it", () => {
    const partial = [...SAMPLE.slice(0, 5), subject([4, 4, 4, 4, 4], 80)];
    partial[5] = {
      ...partial[5]!,
      items: partial[5]!.items.filter((i) => i.id !== "icd_reasoning"),
    };
    const report = computeReliabilityReport(partial);
    expect(report.dimensions).not.toContain("icd_reasoning");
    expect(report.dimensions).toContain("alliance");
  });

  it("flags a configuration-heterogeneous sample as a limitation", () => {
    const mixed = [
      ...SAMPLE.slice(0, 3),
      subject([3, 3, 3, 3, 3], 60, { model: "other-model", prompt: "1.0.0" }),
    ];
    const report = computeReliabilityReport(mixed);
    expect(report.provenance.configuration_homogeneous).toBe(false);
    expect(report.limitations.join(" ")).toMatch(/not configuration-homogeneous/);
  });

  it("always records the non-determinism, anchoring and simulated-IRR limitations", () => {
    const joined = computeReliabilityReport(SAMPLE).limitations.join(" ");
    expect(joined).toMatch(/non-deterministic/i);
    expect(joined).toMatch(/behavioural anchors/i);
    expect(joined).toMatch(/SIMULATED/);
  });
});

describe("extraction from stored reports", () => {
  const storedRow = {
    session_id: "abc",
    language: "en",
    scores: {
      overall: 74,
      items: [
        { id: "alliance", label: "Alliance", score: 4, max: 5, weight: 10, feedback: "x" },
        { id: "safety", label: "Safety", score: 3, max: 5, weight: 8, feedback: "y" },
      ],
      scientific_provenance: {
        ai_model: "gpt-5",
        ai_source: "gpt",
        prompt_engine_version: "1.0.0",
        assessment_mode: "llm_examiner",
      },
      educational_reliability: { inter_rater_r: 0.93, inter_rater_pct_agree: 88 },
    },
  };

  it("maps items, overall and provenance", () => {
    const s = subjectFromStoredReport(storedRow)!;
    expect(s.overall).toBe(74);
    expect(s.items.map((i) => i.id)).toEqual(["alliance", "safety"]);
    expect(s.ai_model).toBe("gpt-5");
    expect(s.prompt_engine_version).toBe("1.0.0");
  });

  it("never carries narrative, excerpts, or the simulated inter-rater value", () => {
    const s = subjectFromStoredReport(storedRow)!;
    const serialized = JSON.stringify(s);
    expect(serialized).not.toMatch(/inter_rater/);
    expect(serialized).not.toMatch(/narrative/);
    expect(serialized).not.toMatch(/excerpt/);
    expect(Object.keys(s).sort()).toEqual(
      [
        "ai_model",
        "ai_source",
        "assessment_mode",
        "items",
        "language",
        "overall",
        "prompt_engine_version",
        "session_id",
      ].sort(),
    );
  });

  it("drops rows with no usable structure instead of zero-filling", () => {
    expect(subjectFromStoredReport({ scores: null })).toBeNull();
    expect(subjectFromStoredReport({ scores: { overall: 50 } })).toBeNull();
    expect(subjectFromStoredReport({ scores: { items: [] } })).toBeNull();
    expect(
      subjectFromStoredReport({ scores: { items: [{ id: "a", score: 1 }] } }),
    ).toBeNull();
    expect(subjectsFromStoredReports([{ scores: null }, storedRow])).toHaveLength(1);
  });

  it("selects a configuration-controlled sub-sample", () => {
    const mixed = [
      ...SAMPLE.slice(0, 2),
      subject([3, 3, 3, 3, 3], 60, { model: "other", prompt: "1.0.0" }),
      subject([2, 2, 2, 2, 2], 40),
    ];
    expect(withCompleteProvenance(mixed)).toHaveLength(3);
    expect(filterToConfiguration(mixed, { model: "gpt-5" })).toHaveLength(2);
    expect(
      filterToConfiguration(mixed, { model: "gpt-5", promptVersion: "9.9.9" }),
    ).toHaveLength(0);
  });
});

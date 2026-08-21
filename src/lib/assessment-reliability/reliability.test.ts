import { describe, expect, it } from "vitest";

import {
  MIN_SUBJECTS_FOR_ALPHA,
  computeReliabilityReport,
  excludeHeuristicFallback,
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

describe("F-FIND-3 — heuristic-fallback subjects cannot masquerade as one configuration", () => {
  function subject(
    mode: string,
    model: string | null,
    seed: number,
  ): ReliabilitySubject {
    return {
      overall: 60 + seed,
      items: [
        { id: "alliance", score: 3, max: 5, weight: 1 },
        { id: "empathy", score: 4, max: 5, weight: 1 },
        { id: "risk", score: 2, max: 5, weight: 1 },
      ],
      ai_model: model,
      ai_source: model ? "gpt" : "persona_fallback",
      prompt_engine_version: "2.0.0",
      assessment_mode: mode,
    };
  }

  const mixed = [
    subject("llm_examiner", "gpt-5-2025-08-07", 1),
    subject("llm_examiner", "gpt-5-2025-08-07", 2),
    subject("llm_examiner", "gpt-5-2025-08-07", 3),
    subject("heuristic_fallback", null, 4),
  ];

  it("does not call a mixed-instrument sample configuration-homogeneous", () => {
    const report = computeReliabilityReport(mixed);
    // Before the fix this was `true`: uniqueDefined() dropped the null model, so
    // distinct_models stayed length 1 and the keyword-scored row was invisible.
    expect(report.provenance.configuration_homogeneous).toBe(false);
  });

  it("counts a partial provenance record as incomplete", () => {
    const report = computeReliabilityReport(mixed);
    // Before the fix this was 0: the fallback row carries a prompt version, and
    // the old test required BOTH fields to be absent.
    expect(report.provenance.subjects_missing_provenance).toBe(1);
  });

  it("names the fallback subjects in an explicit limitation", () => {
    const report = computeReliabilityReport(mixed);
    expect(report.provenance.subjects_heuristic_fallback).toBe(1);
    expect(report.provenance.distinct_assessment_modes).toEqual([
      "heuristic_fallback",
      "llm_examiner",
    ]);
    expect(
      report.limitations.some((l) => /HEURISTIC KEYWORD FALLBACK/.test(l)),
    ).toBe(true);
  });

  it("excludeHeuristicFallback restores a clean, homogeneous sample", () => {
    const clean = excludeHeuristicFallback(mixed);
    expect(clean).toHaveLength(3);
    const report = computeReliabilityReport(clean);
    expect(report.provenance.configuration_homogeneous).toBe(true);
    expect(report.provenance.subjects_missing_provenance).toBe(0);
    expect(report.provenance.subjects_heuristic_fallback).toBe(0);
    expect(
      report.limitations.some((l) => /HEURISTIC KEYWORD FALLBACK/.test(l)),
    ).toBe(false);
  });

  it("an all-fallback sample is still flagged, not silently accepted", () => {
    const allFallback = [
      subject("heuristic_fallback", null, 1),
      subject("heuristic_fallback", null, 2),
    ];
    const report = computeReliabilityReport(allFallback);
    expect(report.provenance.configuration_homogeneous).toBe(false);
    expect(report.provenance.subjects_heuristic_fallback).toBe(2);
  });
});

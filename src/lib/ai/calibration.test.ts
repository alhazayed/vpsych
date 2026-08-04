import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  calibrationReference,
  corpusInterRaterReliability,
  validateCalibrationCase,
  type CalibrationCase,
} from "@/lib/ai/calibration";
import {
  CALIBRATION_DIR,
  loadCalibrationCases,
} from "@/lib/ai/calibration-load";

const RUBRIC = [
  { id: "alliance", label: "Therapeutic alliance", weight: 25, max: 5 },
  { id: "safety", label: "Risk & safety", weight: 75, max: 5 },
];

function validCase(overrides: Record<string, unknown> = {}) {
  return {
    caseId: "CASE-1",
    language: "en",
    durationSec: 1200,
    avatar: {
      name: "Example",
      disorder: "MDD",
      ideal_guidelines: { session_goals: ["screen mood"], ideal_approach: "…" },
      rubric: RUBRIC,
    },
    transcript: [
      { role: "user", content: "How have you been sleeping?" },
      { role: "assistant", content: "Badly." },
    ],
    expertRatings: [
      { raterId: "R1", items: { alliance: 4, safety: 3 } },
      { raterId: "R2", items: { alliance: 3, safety: 4 } },
    ],
    ...overrides,
  };
}

describe("validateCalibrationCase", () => {
  it("accepts a well-formed case", () => {
    const result = validateCalibrationCase(validCase());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.caseId).toBe("CASE-1");
      expect(result.value.fixture).toBe(false);
      expect(result.value.expertRatings).toHaveLength(2);
    }
  });

  it("requires at least two independent raters", () => {
    const result = validateCalibrationCase(
      validCase({ expertRatings: [{ raterId: "R1", items: { alliance: 4, safety: 3 } }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/at least two independent raters/);
    }
  });

  it("rejects a rater who skipped a rubric item", () => {
    const result = validateCalibrationCase(
      validCase({
        expertRatings: [
          { raterId: "R1", items: { alliance: 4 } },
          { raterId: "R2", items: { alliance: 3, safety: 4 } },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(
        /"R1".*missing a numeric score for rubric item "safety"/,
      );
    }
  });

  it("rejects a score outside the item's scale", () => {
    const result = validateCalibrationCase(
      validCase({
        expertRatings: [
          { raterId: "R1", items: { alliance: 9, safety: 3 } },
          { raterId: "R2", items: { alliance: 3, safety: 4 } },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/outside the 0–5 scale/);
    }
  });

  it("rejects a transcript with no therapist turns", () => {
    const result = validateCalibrationCase(
      validCase({
        transcript: [{ role: "assistant", content: "I've been low." }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/no therapist \(user\) turns/);
    }
  });

  it("reports every problem in one pass rather than the first", () => {
    const result = validateCalibrationCase({
      caseId: "",
      language: "fr",
      durationSec: -1,
      transcript: [],
      expertRatings: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
      expect(result.errors.join(" ")).toMatch(/caseId/);
      expect(result.errors.join(" ")).toMatch(/language/);
      expect(result.errors.join(" ")).toMatch(/durationSec/);
    }
  });

  it("rejects duplicate rubric ids and duplicate raters", () => {
    const dupRubric = validateCalibrationCase(
      validCase({
        avatar: {
          name: "Example",
          disorder: "MDD",
          ideal_guidelines: {},
          rubric: [...RUBRIC, RUBRIC[0]],
        },
      }),
    );
    expect(dupRubric.ok).toBe(false);

    const dupRater = validateCalibrationCase(
      validCase({
        expertRatings: [
          { raterId: "R1", items: { alliance: 4, safety: 3 } },
          { raterId: "R1", items: { alliance: 3, safety: 4 } },
        ],
      }),
    );
    expect(dupRater.ok).toBe(false);
    if (!dupRater.ok) {
      expect(dupRater.errors.join(" ")).toMatch(/duplicate raterId/);
    }
  });
});

describe("calibrationReference", () => {
  it("averages raters into a consensus reference", () => {
    const parsed = validateCalibrationCase(validCase());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const reference = calibrationReference(parsed.value);
    expect(reference.consensus.alliance).toBeCloseTo(3.5, 10);
    expect(reference.consensus.safety).toBeCloseTo(3.5, 10);
    expect(reference.raters).toBe(2);
    // alliance 3.5/5 at weight 25 + safety 3.5/5 at weight 75 → 70.
    expect(reference.consensusOverall).toBe(70);
  });

  it("returns no per-case ICC when the ratings carry no between-item variance", () => {
    // Two raters, two items, scored 4/3 and 3/4: every item mean is identical,
    // so there is nothing for the model to explain and ICC is undefined.
    // A two-line rubric is why per-case ICC is not worth quoting — use
    // corpusInterRaterReliability across the whole corpus instead.
    const parsed = validateCalibrationCase(validCase());
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));
    expect(calibrationReference(parsed.value).interRater).toBeNull();
  });

  it("reports poor agreement when raters genuinely diverge", () => {
    const parsed = validateCalibrationCase(
      validCase({
        expertRatings: [
          { raterId: "R1", items: { alliance: 5, safety: 1 } },
          { raterId: "R2", items: { alliance: 1, safety: 2 } },
        ],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));

    const reference = calibrationReference(parsed.value);
    expect(reference.interRater).not.toBeNull();
    expect(reference.interRater!.icc).toBeLessThan(0.5);
  });
});

describe("corpusInterRaterReliability", () => {
  const build = (id: string, r1: number[], r2: number[]): CalibrationCase => {
    const parsed = validateCalibrationCase(
      validCase({
        caseId: id,
        expertRatings: [
          { raterId: "R1", items: { alliance: r1[0], safety: r1[1] } },
          { raterId: "R2", items: { alliance: r2[0], safety: r2[1] } },
        ],
      }),
    );
    if (!parsed.ok) throw new Error(parsed.errors.join("; "));
    return parsed.value;
  };

  it("pools every (case, item) pair into one coefficient", () => {
    const result = corpusInterRaterReliability([
      build("A", [5, 1], [5, 1]),
      build("B", [2, 4], [2, 4]),
      build("C", [3, 5], [3, 5]),
    ]);
    expect(result).not.toBeNull();
    expect(result!.icc).toBeCloseTo(1, 10);
    expect(result!.subjects).toBe(6);
    expect(result!.raters).toBe(2);
  });

  it("refuses a corpus whose rater set varies between cases", () => {
    const a = build("A", [5, 1], [5, 1]);
    const b = build("B", [2, 4], [2, 4]);
    b.expertRatings[1]!.raterId = "R3";
    expect(corpusInterRaterReliability([a, b])).toBeNull();
  });

  it("returns null for an empty corpus", () => {
    expect(corpusInterRaterReliability([])).toBeNull();
  });
});

describe("loadCalibrationCases", () => {
  const dir = join(process.cwd(), CALIBRATION_DIR);

  it("loads the committed corpus without validation errors", () => {
    const result = loadCalibrationCases(dir);
    expect(result.errors).toEqual([]);
  });

  it("keeps synthetic fixtures out of the real case list", () => {
    const result = loadCalibrationCases(dir);
    expect(result.fixtures.length).toBeGreaterThan(0);
    expect(result.fixtures.every((c) => c.fixture)).toBe(true);
    expect(result.cases.every((c) => !c.fixture)).toBe(true);
  });

  it("derives a usable reference from the shipped fixture", () => {
    const { fixtures } = loadCalibrationCases(dir);
    const fixture = fixtures.find(
      (c) => c.caseId === "VPSY-CAL-FIXTURE-000",
    );
    expect(fixture).toBeDefined();

    const reference = calibrationReference(fixture!);
    expect(reference.consensus.alliance).toBeCloseTo(4, 10);
    expect(reference.consensus.assessment).toBeCloseTo(3.5, 10);
    expect(reference.consensus.safety).toBeCloseTo(4.5, 10);
    expect(reference.consensusOverall).toBe(71);
  });

  it("reports a missing directory instead of throwing", () => {
    const result = loadCalibrationCases(join(dir, "does-not-exist"));
    expect(result.cases).toEqual([]);
    expect(result.errors[0]).toMatch(/cannot read calibration dir/);
  });
});

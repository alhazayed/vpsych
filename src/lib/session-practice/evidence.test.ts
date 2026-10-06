import { describe, expect, it } from "vitest";
import { buildScoreEvidence, reportAssessmentMode } from "@/lib/session-practice/evidence";
import { evaluateSessionPractice } from "@/lib/session-practice";
import type { SessionPracticeReport } from "@/lib/session-practice/types";

function turns(therapist: string[]) {
  return therapist.flatMap((content) => [
    { role: "user", content },
    { role: "assistant", content: "Okay." },
  ]);
}

const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => `Tell me a bit more about that, part ${i}.`);

const items = [
  { id: "structure" },
  { id: "alliance" },
  { id: "safety" },
];

describe("buildScoreEvidence", () => {
  it("labels every item limited for a heuristic fallback report", () => {
    const messages = turns(filler(10));
    const out = buildScoreEvidence({
      items,
      messages,
      practice: evaluateSessionPractice({ messages }),
      assessmentMode: "heuristic_fallback",
    });
    expect(out.every((e) => e.level === "limited" && e.reason === "keyword_estimate")).toBe(true);
  });

  it("labels every item limited when the therapist barely spoke", () => {
    const messages = turns(filler(2));
    const out = buildScoreEvidence({
      items,
      messages,
      practice: evaluateSessionPractice({ messages }),
    });
    expect(out.map((e) => e.reason)).toEqual(["few_turns", "few_turns", "few_turns"]);
  });

  it("never marks an item without a transcript check as strong", () => {
    const messages = turns(filler(12));
    const [, alliance] = buildScoreEvidence({
      items,
      messages,
      practice: evaluateSessionPractice({ messages }),
    });
    expect(alliance).toMatchObject({ level: "some", reason: "examiner_judgement" });
  });

  it("is limited when the item's behaviour was not seen", () => {
    const messages = turns(filler(10));
    const [structure] = buildScoreEvidence({
      items,
      messages,
      practice: evaluateSessionPractice({ messages }),
    });
    expect(structure).toMatchObject({ level: "limited", reason: "no_observed_behaviour" });
  });

  it("is strong when several matching practices were observed in a long session", () => {
    const messages = turns(filler(10));
    const practice: SessionPracticeReport = {
      ...evaluateSessionPractice({ messages }),
    };
    practice.checks = practice.checks.map((c) =>
      c.group === "structure" ? { ...c, applicable: true, detected: true } : c,
    );
    const [structure] = buildScoreEvidence({ items, messages, practice });
    expect(structure?.level).toBe("strong");
    expect(structure?.observed).toBeGreaterThanOrEqual(2);
  });

  it("falls back to examiner judgement when safety planning is not applicable", () => {
    const messages = turns(filler(10));
    const [, , safety] = buildScoreEvidence({
      items,
      messages,
      practice: evaluateSessionPractice({ messages, riskPresent: false }),
    });
    expect(safety?.reason).toBe("examiner_judgement");
  });
});

describe("reportAssessmentMode", () => {
  it("reads the mode from either provenance block", () => {
    expect(reportAssessmentMode({ scientific_provenance: { assessment_mode: "llm_examiner" } })).toBe(
      "llm_examiner",
    );
    expect(
      reportAssessmentMode({ educational_reliability: { assessment_mode: "heuristic_fallback" } }),
    ).toBe("heuristic_fallback");
    expect(reportAssessmentMode(null)).toBeNull();
  });
});

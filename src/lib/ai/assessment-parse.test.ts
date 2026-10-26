import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  normalizeAssessmentPayload,
  parseAssessmentModelText,
} from "@/lib/ai/assessment-parse";

const valid = {
  items: [
    { id: "alliance", score: 4, feedback: "Good rapport." },
    { id: "assessment", score: "3", feedback: "Some exploration." },
    { id: "interventions", score: 2, feedback: "Limited skills." },
    { id: "safety", score: 5, feedback: "Safety checked." },
    { id: "structure", score: 3, feedback: "Adequate structure." },
  ],
  narrative: "Solid first session with clear safety inquiry.",
  excerpts: ["How have you been feeling?"],
};

describe("assessment JSON parsing", () => {
  it("parses raw JSON and coerces string scores", () => {
    const out = parseAssessmentModelText(JSON.stringify(valid));
    expect(out.items[1]?.score).toBe(3);
    expect(out.narrative).toContain("Solid first session");
  });

  it("extracts JSON from markdown fences", () => {
    const fenced = `Here is the report:\n\`\`\`json\n${JSON.stringify(valid)}\n\`\`\`\n`;
    const out = parseAssessmentModelText(fenced);
    expect(out.excerpts[0]).toBe("How have you been feeling?");
  });

  it("extracts the first JSON object from leading prose", () => {
    const prose = `Sure.\n${JSON.stringify(valid)}\nThanks.`;
    expect(extractJsonObject(prose)).toMatchObject({
      narrative: valid.narrative,
    });
  });

  it("rejects a null or blank score instead of turning it into 0", () => {
    for (const score of [null, "", "  "]) {
      const bad = { ...valid, items: [{ id: "alliance", score, feedback: "x" }] };
      expect(() => parseAssessmentModelText(JSON.stringify(bad))).toThrow();
    }
  });

  it("accepts a null score only on a cannot_score item", () => {
    for (const status of ["cannot_score", "Cannot score", "insufficient-evidence"]) {
      const ok = {
        ...valid,
        items: [{ id: "alliance", status, score: null, feedback: "", reason: "Too short." }],
      };
      const out = parseAssessmentModelText(JSON.stringify(ok));
      expect(out.items[0]).toMatchObject({ status: "cannot_score", score: undefined, reason: "Too short." });
    }
    const bad = { ...valid, items: [{ id: "alliance", status: "scored", score: null, feedback: "x" }] };
    expect(() => parseAssessmentModelText(JSON.stringify(bad))).toThrow(/score/);
  });

  it("treats an unknown or missing status as scored and keeps evidence for checking", () => {
    const out = parseAssessmentModelText(
      JSON.stringify({
        ...valid,
        items: [{ id: "alliance", status: "maybe", score: 4, feedback: "x", evidence: [{ turn: 1, quote: "q" }] }],
      }),
    );
    expect(out.items[0]).toMatchObject({ status: "scored", score: 4, evidence: [{ turn: 1, quote: "q" }] });
    expect(parseAssessmentModelText(JSON.stringify(valid)).items[0]?.status).toBe("scored");
  });

  it("rejects empty responses", () => {
    expect(() => parseAssessmentModelText("   ")).toThrow(/empty/i);
  });

  it("accepts more than 5 excerpts and truncates", () => {
    const many = {
      ...valid,
      excerpts: ["a", "b", "c", "d", "e", "f", "g"],
      items: valid.items.map((i) => ({ ...i, score: 9 })),
    };
    const out = parseAssessmentModelText(JSON.stringify(many));
    expect(out.excerpts).toHaveLength(5);
    expect(out.items.every((i) => i.score === 5)).toBe(true);
  });

  it("normalizes object-shaped items (verified GPT failure mode)", () => {
    const objectItems = {
      items: {
        alliance: { score: 4, feedback: "Warm opening." },
        assessment: { score: "3", feedback: "Some exploration." },
        interventions: { score: 2, feedback: "Supportive." },
        safety: { score: 5, feedback: "Safety checked." },
        structure: { score: 3, feedback: "Clear start." },
      },
      narrative: "Therapist opened with mood and safety.",
      excerpts: ["How have you been feeling?"],
    };
    const normalized = normalizeAssessmentPayload(objectItems) as {
      items: { id: string }[];
    };
    expect(Array.isArray(normalized.items)).toBe(true);
    expect(normalized.items.map((i) => i.id)).toContain("safety");
    const out = parseAssessmentModelText(JSON.stringify(objectItems));
    expect(out.items).toHaveLength(5);
    expect(out.items.find((i) => i.id === "alliance")?.score).toBe(4);
    expect(out.narrative).toContain("mood and safety");
  });
});

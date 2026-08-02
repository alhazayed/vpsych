import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
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

  it("rejects empty responses", () => {
    expect(() => parseAssessmentModelText("   ")).toThrow(/empty/i);
  });
});

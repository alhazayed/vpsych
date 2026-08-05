import { describe, expect, it } from "vitest";
import { assessSession } from "@/lib/ai/assessment";
import { RUBRIC_TO_COMPETENCIES } from "@/lib/ace/catalog";
import { mapRubricToCompetencies } from "@/lib/ace/analytics";

describe("W3-H3 dual-coding rubric", () => {
  it("default heuristic assessment emits dsm_reasoning and icd_reasoning", async () => {
    const prevOpenAi = process.env.OPENAI_API_KEY;
    const prevGateway = process.env.AI_GATEWAY_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    try {
      const result = await assessSession({
        avatar: {
          name: "Maya",
          disorder: "PTSD",
          ideal_guidelines: {
            session_goals: ["Assess trauma", "Safety"],
            ideal_approach: "Trauma-informed",
          },
          rubric: [],
        },
        messages: [
          {
            role: "user",
            content:
              "Let's walk through DSM criteria and also the ICD-11 diagnosis differential for PTSD versus CPTSD.",
            created_at: new Date().toISOString(),
          },
          {
            role: "assistant",
            content: "I don't know the codes. I just can't sleep.",
            created_at: new Date().toISOString(),
          },
          {
            role: "user",
            content: "Any thoughts of harming yourself?",
            created_at: new Date().toISOString(),
          },
        ],
        durationSec: 600,
        language: "en",
      });
      const ids = result.scores.items.map((i) => i.id);
      expect(ids).toContain("dsm_reasoning");
      expect(ids).toContain("icd_reasoning");
      expect(ids).toContain("assessment");
      expect(result.scores.overall).toBeGreaterThan(0);

      const mapped = mapRubricToCompetencies(
        result.scores.items,
        result.scores.overall,
      );
      expect(mapped.dsm5_reasoning).toBeTypeOf("number");
      expect(mapped.icd11_reasoning).toBeTypeOf("number");
    } finally {
      if (prevOpenAi) process.env.OPENAI_API_KEY = prevOpenAi;
      if (prevGateway) process.env.AI_GATEWAY_API_KEY = prevGateway;
    }
  });

  it("rubric map keeps dual-coding distinct", () => {
    expect(RUBRIC_TO_COMPETENCIES.dsm_reasoning).toContain("dsm5_reasoning");
    expect(RUBRIC_TO_COMPETENCIES.icd_reasoning).toContain("icd11_reasoning");
    expect(RUBRIC_TO_COMPETENCIES.assessment).not.toContain("icd11_reasoning");
  });
});

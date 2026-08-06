import { describe, expect, it } from "vitest";
import { assessSession } from "@/lib/ai/assessment";
import { RUBRIC_TO_COMPETENCIES } from "@/lib/ace/catalog";
import { mapRubricToCompetencies } from "@/lib/ace/analytics";
import { DEFAULT_RUBRIC_LABELS_EN } from "@/lib/ai/report-locale";

const W3_H3_REQUIRED = [
  "dsm_reasoning",
  "icd_reasoning",
  "clinical_formulation",
  "differential_diagnosis",
  "risk_formulation",
  "educational_competency",
] as const;

describe("W3-H3 dual-coding + educational rubric", () => {
  it("default heuristic assessment emits all Wave-3 educational dimensions", async () => {
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
              "Let's walk through DSM criteria and also the ICD-11 diagnosis differential for PTSD versus CPTSD, then build a formulation and risk plan aligned to learning objectives.",
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
      for (const id of W3_H3_REQUIRED) {
        expect(ids).toContain(id);
        expect(DEFAULT_RUBRIC_LABELS_EN[id]).toBeTruthy();
      }
      expect(result.scores.items).toHaveLength(11);
      expect(
        result.scores.items.reduce((a, i) => a + i.weight, 0),
      ).toBe(100);
      expect(result.scores.overall).toBeGreaterThan(0);

      const mapped = mapRubricToCompetencies(
        result.scores.items,
        result.scores.overall,
      );
      expect(mapped.dsm5_reasoning).toBeTypeOf("number");
      expect(mapped.icd11_reasoning).toBeTypeOf("number");
      expect(mapped.differential_diagnosis).toBeTypeOf("number");
      expect(mapped.risk_assessment).toBeTypeOf("number");
    } finally {
      if (prevOpenAi) process.env.OPENAI_API_KEY = prevOpenAi;
      if (prevGateway) process.env.AI_GATEWAY_API_KEY = prevGateway;
    }
  });

  it("rubric map keeps dual-coding and formulation distinct", () => {
    expect(RUBRIC_TO_COMPETENCIES.dsm_reasoning).toContain("dsm5_reasoning");
    expect(RUBRIC_TO_COMPETENCIES.icd_reasoning).toContain("icd11_reasoning");
    expect(RUBRIC_TO_COMPETENCIES.clinical_formulation?.length).toBeGreaterThan(
      0,
    );
    expect(RUBRIC_TO_COMPETENCIES.differential_diagnosis).toContain(
      "differential_diagnosis",
    );
    expect(RUBRIC_TO_COMPETENCIES.risk_formulation).toContain("risk_assessment");
    expect(RUBRIC_TO_COMPETENCIES.educational_competency).toContain(
      "documentation",
    );
    expect(RUBRIC_TO_COMPETENCIES.assessment).not.toContain("icd11_reasoning");
  });
});

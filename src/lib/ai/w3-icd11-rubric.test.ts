import { describe, expect, it } from "vitest";
import { assessSession } from "@/lib/ai/assessment";
import { RUBRIC_TO_COMPETENCIES } from "@/lib/ace/catalog";
import { mapRubricToCompetencies } from "@/lib/ace/analytics";
import { DEFAULT_RUBRIC_LABELS_EN } from "@/lib/ai/report-locale";
import { CLINICAL_EDUCATOR_DIMENSION_IDS } from "@/lib/clinical-educator";

describe("Mission 9 Clinical Educator default rubric", () => {
  it("default heuristic assessment emits all ten Clinical Educator dimensions", async () => {
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
              "Nice to meet you. Sounds hard. When did symptoms start? Any thoughts of harming yourself? We can work together on a plan before we end today.",
            created_at: new Date().toISOString(),
          },
          {
            role: "assistant",
            content: "I don't know the codes. I just can't sleep.",
            created_at: new Date().toISOString(),
          },
          {
            role: "user",
            content:
              "Let's walk through DSM criteria carefully and set next treatment steps.",
            created_at: new Date().toISOString(),
          },
        ],
        durationSec: 600,
        language: "en",
      });
      const ids = result.scores.items.map((i) => i.id);
      for (const id of CLINICAL_EDUCATOR_DIMENSION_IDS) {
        expect(ids).toContain(id);
        expect(DEFAULT_RUBRIC_LABELS_EN[id]).toBeTruthy();
      }
      expect(result.scores.items).toHaveLength(10);
      expect(
        result.scores.items.reduce((a, i) => a + i.weight, 0),
      ).toBe(100);
      expect(result.scores.overall).toBeGreaterThan(0);
      expect(result.scores.clinical_educator?.dimensions).toHaveLength(10);

      const mapped = mapRubricToCompetencies(
        result.scores.items,
        result.scores.overall,
      );
      expect(mapped.dsm5_reasoning).toBeTypeOf("number");
      expect(mapped.risk_assessment).toBeTypeOf("number");
      expect(mapped.therapeutic_alliance).toBeTypeOf("number");
      expect(mapped.empathy).toBeTypeOf("number");
      expect(mapped.treatment_planning).toBeTypeOf("number");
    } finally {
      if (prevOpenAi) process.env.OPENAI_API_KEY = prevOpenAi;
      if (prevGateway) process.env.AI_GATEWAY_API_KEY = prevGateway;
    }
  });

  it("rubric map keeps Mission 9 + legacy dual-coding maps distinct", () => {
    expect(RUBRIC_TO_COMPETENCIES.rapport).toContain("therapeutic_alliance");
    expect(RUBRIC_TO_COMPETENCIES.empathy).toContain("empathy");
    expect(RUBRIC_TO_COMPETENCIES.risk_assessment).toContain("risk_assessment");
    expect(RUBRIC_TO_COMPETENCIES.history_taking).toContain("diagnostic_interview");
    expect(RUBRIC_TO_COMPETENCIES.dsm_reasoning).toContain("dsm5_reasoning");
    expect(RUBRIC_TO_COMPETENCIES.therapeutic_alliance).toContain(
      "therapeutic_alliance",
    );
    expect(RUBRIC_TO_COMPETENCIES.communication).toContain(
      "professional_communication",
    );
    expect(RUBRIC_TO_COMPETENCIES.professionalism).toContain(
      "ethical_decision_making",
    );
    expect(RUBRIC_TO_COMPETENCIES.session_structure).toContain("time_management");
    expect(RUBRIC_TO_COMPETENCIES.treatment_planning).toContain(
      "treatment_planning",
    );
    // Legacy Wave-3 maps retained for avatar-authored rubrics
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

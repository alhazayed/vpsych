import { describe, expect, it } from "vitest";
import {
  buildClinicalEducatorDashboard,
  buildClinicalEducatorPdfPackage,
  buildClinicalEducatorReport,
  CLINICAL_EDUCATOR_DIMENSION_IDS,
  CLINICAL_EDUCATOR_RUBRIC,
  CLINICAL_EDUCATOR_RUBRIC_VERSION,
  CLINICAL_EDUCATOR_VERSION,
  clinicalEducatorDefaultRubric,
  extractTranscriptExamples,
  heuristicClinicalEducatorScores,
} from "@/lib/clinical-educator";
import { RUBRIC_SCHEMA_VERSION } from "@/lib/scientific/versions";

const richMessages = [
  {
    role: "user" as const,
    content:
      "Nice to meet you — I'm glad you're here today. Sounds like work has been heavy.",
  },
  {
    role: "assistant" as const,
    content: "Yeah… exhausted. Hard to sleep.",
  },
  {
    role: "user" as const,
    content:
      "When did the sleep problems start? Any thoughts of suicide or wanting to harm yourself? Tell me more about your mood over the past two weeks.",
  },
  {
    role: "assistant" as const,
    content: "About a month. No plan. Just tired of feeling this way.",
  },
  {
    role: "user" as const,
    content:
      "We can work together on a plan. Before we end, let's summarize today's goals and next steps for therapy.",
  },
];

describe("Clinical Educator rubrics", () => {
  it("defines exactly ten dimensions with weights summing to 100", () => {
    expect(CLINICAL_EDUCATOR_DIMENSION_IDS).toHaveLength(10);
    expect(CLINICAL_EDUCATOR_RUBRIC).toHaveLength(10);
    const sum = CLINICAL_EDUCATOR_RUBRIC.reduce((s, r) => s + r.weight, 0);
    expect(sum).toBe(100);
    expect(CLINICAL_EDUCATOR_RUBRIC.map((r) => r.id)).toEqual([
      "rapport",
      "empathy",
      "risk_assessment",
      "history_taking",
      "dsm_reasoning",
      "therapeutic_alliance",
      "communication",
      "professionalism",
      "session_structure",
      "treatment_planning",
    ]);
  });

  it("locks rubric schema into scientific provenance id", () => {
    expect(CLINICAL_EDUCATOR_RUBRIC_VERSION).toBe("clinical-educator-v1");
    expect(RUBRIC_SCHEMA_VERSION).toBe(CLINICAL_EDUCATOR_RUBRIC_VERSION);
    expect(CLINICAL_EDUCATOR_VERSION).toBe("1.0.0");
  });

  it("exports assessment rubric items for both locales", () => {
    const en = clinicalEducatorDefaultRubric("en");
    const ar = clinicalEducatorDefaultRubric("ar");
    expect(en).toHaveLength(10);
    expect(ar[0]!.label).toMatch(/ألفة|تعاطف|ألفة|بناء/);
    expect(en.every((r) => r.max === 5)).toBe(true);
  });
});

describe("Clinical Educator scoring engine", () => {
  it("mines transcript examples for risk and empathy cues", () => {
    const risk = extractTranscriptExamples(
      richMessages,
      ["suicid", "harm", "safe"],
      2,
    );
    expect(risk.length).toBeGreaterThan(0);
    expect(risk[0]).toMatch(/suicid|harm/i);

    const empathy = extractTranscriptExamples(
      richMessages,
      ["sounds like", "hear", "feel"],
      2,
    );
    expect(empathy.some((e) => /sounds like/i.test(e))).toBe(true);
  });

  it("produces heuristic scores for all ten dimensions with examples", () => {
    const items = heuristicClinicalEducatorScores(richMessages, "en");
    expect(items).toHaveLength(10);
    for (const item of items) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(5);
      expect(item.feedback.length).toBeGreaterThan(0);
    }
    const risk = items.find((i) => i.id === "risk_assessment");
    expect(risk?.examples?.length).toBeGreaterThan(0);
  });

  it("builds detailed educational report with coaching excerpts", () => {
    const items = heuristicClinicalEducatorScores(richMessages, "en");
    const report = buildClinicalEducatorReport({
      items,
      messages: richMessages,
      language: "en",
      narrative: "Solid opening with risk inquiry.",
      excerpts: ["Sounds like work has been heavy."],
      assessment_mode: "heuristic_fallback",
    });
    expect(report.dimensions).toHaveLength(10);
    expect(report.composite).toBeGreaterThan(0);
    expect(report.educational_summary).toMatch(/Clinical Educator|strengths/i);
    expect(report.coaching_excerpts.length).toBeGreaterThan(0);
    expect(report.disclaimer).toMatch(/formative/i);
    for (const d of report.dimensions) {
      expect(d.strengths.length).toBeGreaterThan(0);
      expect(d.growth_areas.length).toBeGreaterThan(0);
      expect(d.next_practice.length).toBeGreaterThan(0);
    }
  });

  it("builds Arabic educational copy when language=ar", () => {
    const items = heuristicClinicalEducatorScores(richMessages, "ar");
    const report = buildClinicalEducatorReport({
      items,
      messages: richMessages,
      language: "ar",
      narrative: "",
      excerpts: [],
      assessment_mode: "heuristic_fallback",
    });
    expect(report.disclaimer).toMatch(/تكوينية/);
    expect(report.dimensions[0]!.label).toBeTruthy();
  });
});

describe("Clinical Educator dashboard + PDF", () => {
  it("aggregates dimension averages across stored rows", () => {
    const items = heuristicClinicalEducatorScores(richMessages, "en");
    const report = buildClinicalEducatorReport({
      items,
      messages: richMessages,
      language: "en",
      narrative: "n",
      excerpts: [],
      assessment_mode: "llm_examiner",
    });
    const dashboard = buildClinicalEducatorDashboard([
      {
        session_id: "s1",
        therapist_name: "Ada",
        patient_name: "Maya",
        language: "en",
        created_at: new Date().toISOString(),
        clinical_educator: report,
      },
      {
        session_id: "s2",
        therapist_name: "Bea",
        patient_name: "Omar",
        language: "en",
        created_at: new Date().toISOString(),
        legacy_items: items,
        legacy_overall: 70,
      },
    ]);
    expect(dashboard.n_reports).toBe(2);
    expect(dashboard.dimension_averages).toHaveLength(10);
    expect(dashboard.recent).toHaveLength(2);
    expect(
      dashboard.dimension_averages.some((d) => d.n > 0 && d.average_percent > 0),
    ).toBe(true);
  });

  it("emits print-ready PDF HTML with transcript examples", () => {
    const items = heuristicClinicalEducatorScores(richMessages, "en");
    const report = buildClinicalEducatorReport({
      items,
      messages: richMessages,
      language: "en",
      narrative: "Coachable session.",
      excerpts: ["We can work together on a plan."],
      assessment_mode: "llm_examiner",
    });
    const pdf = buildClinicalEducatorPdfPackage(report, {
      session_id: "abc-123",
      therapist_name: "Ada Lovelace",
      patient_name: "Maya Chen",
      disorder: "MDD",
    });
    expect(pdf.format).toBe("vpsych-clinical-educator-pdf");
    expect(pdf.html).toContain("Clinical Educator Report");
    expect(pdf.html).toContain("Rapport");
    expect(pdf.html).toContain("Transcript examples");
    expect(pdf.html).toContain("Ada Lovelace");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildExaminerSystemPrompt,
  heuristicCopy,
  localizeRubricLabel,
  normalizeReportLanguage,
} from "@/lib/ai/report-locale";

describe("normalizeReportLanguage", () => {
  it("maps Arabic tags to ar and everything else to en", () => {
    expect(normalizeReportLanguage("ar")).toBe("ar");
    expect(normalizeReportLanguage("ar-JO")).toBe("ar");
    expect(normalizeReportLanguage("AR-SA")).toBe("ar");
    expect(normalizeReportLanguage("en")).toBe("en");
    expect(normalizeReportLanguage("en-US")).toBe("en");
    expect(normalizeReportLanguage(null)).toBe("en");
  });
});

describe("localizeRubricLabel", () => {
  it("returns native Arabic labels for known ids", () => {
    expect(localizeRubricLabel("alliance", "Alliance", "ar")).toContain("التحالف");
    expect(localizeRubricLabel("alliance", "Alliance", "en")).toMatch(/alliance/i);
    expect(localizeRubricLabel("rapport", "Rapport", "en")).toBe("Rapport");
    expect(localizeRubricLabel("empathy", "Empathy", "ar")).toBe("التعاطف");
  });
});

describe("buildExaminerSystemPrompt", () => {
  const base = {
    patientName: "Maya",
    disorder: "MDD",
    approach: "Warm CBT",
    goals: "Alliance",
    durationSec: 1200,
    rubricLines: "alliance — Alliance",
  };

  it("requires native Arabic composition for ar", () => {
    const prompt = buildExaminerSystemPrompt({ ...base, language: "ar" });
    expect(prompt).toContain("ممنوع الترجمة");
    expect(prompt).toContain("بالعربية");
    expect(prompt).not.toContain("Compose natively in English");
  });

  it("requires native English composition for en", () => {
    const prompt = buildExaminerSystemPrompt({ ...base, language: "en" });
    expect(prompt).toContain("Compose natively in English");
    expect(prompt).not.toContain("ممنوع الترجمة");
  });

  it("treats the transcript as untrusted data (prompt-injection resistance)", () => {
    const en = buildExaminerSystemPrompt({ ...base, language: "en" });
    const ar = buildExaminerSystemPrompt({ ...base, language: "ar" });
    expect(en).toContain("untrusted observational data");
    expect(ar).toContain("بيانات رصد غير موثوقة");
  });
});

describe("heuristicCopy", () => {
  it("returns Arabic heuristic copy for ar", () => {
    const copy = heuristicCopy("ar", 3);
    expect(copy.feedback).toContain("درجة تقديرية");
    expect(copy.narrativeWithTurns).toContain("المعلّم السريري");
  });

  it("does not claim key missing when AI was unavailable", () => {
    const copy = heuristicCopy("en", 2, "unavailable");
    expect(copy.narrativeWithTurns).toContain("persona_fallback");
    expect(copy.narrativeWithTurns).toContain("AI assessment failed");
    expect(copy.narrativeWithTurns).not.toContain("AI key not configured");
  });
});

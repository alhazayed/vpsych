import { describe, expect, it } from "vitest";
import {
  analyzeArabicSpeech,
  containsArabicScript,
  expandArabicNumbers,
  expandClinicalAbbreviations,
  prepareArabicSpeech,
  prepareArabicSpeechText,
  applyClinicalTashkeel,
} from "@/lib/arabic-speech";

describe("Arabic Speech Preparation Engine", () => {
  it("leaves pure English untouched", () => {
    const raw = "I feel anxious today.";
    const result = prepareArabicSpeech(raw);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(raw);
  });

  it("detects Arabic script", () => {
    expect(containsArabicScript("مرحبا")).toBe(true);
    expect(containsArabicScript("hello")).toBe(false);
  });

  it("expands digit + unit patterns per clinical TTS examples", () => {
    expect(expandArabicNumbers("3 أيام")).toBe("ثلاثة أيام");
    expect(expandArabicNumbers("2 مرات")).toBe("مرتين");
    expect(expandArabicNumbers("10 دقائق")).toBe("عشر دقائق");
    expect(expandArabicNumbers("١ جلسة")).toBe("جلسة واحدة");
    expect(expandArabicNumbers("٢ أسبوع")).toBe("أسبوعين");
  });

  it("does not expand bare years without units", () => {
    expect(expandArabicNumbers("من ٢٠٢٥")).toBe("من ٢٠٢٥");
    expect(expandArabicNumbers("في 2024")).toBe("في 2024");
  });

  it("expands Latin clinical abbreviations", () => {
    expect(expandClinicalAbbreviations("عندي ADHD من زمان")).toBe(
      "عندي اضطراب فرط الحركة وتشتت الانتباه من زمان",
    );
    expect(expandClinicalAbbreviations("يشبه OCD")).toContain(
      "الوَسْوَاس القَهْرِي",
    );
    expect(expandClinicalAbbreviations("بعد PTSD")).toContain(
      "اضطراب ما بعد الصدمة",
    );
  });

  it("applies selective clinical tashkeel without rewriting meaning", () => {
    expect(applyClinicalTashkeel("القلق بخوفني")).toBe("القَلَق بخوفني");
    expect(applyClinicalTashkeel("الفصام مو سهل")).toBe("الفُصَام مو سهل");
    expect(applyClinicalTashkeel("الذهان والهلوسة")).toBe(
      "الذُّهَان والهَلْوَسَة",
    );
    expect(applyClinicalTashkeel("اضطراب ثنائي القطب")).toBe(
      "اضطراب ثُنَائِيِّ القُطْب",
    );
    expect(applyClinicalTashkeel("القَلَق")).toBe("القَلَق");
  });

  it("preserves Levantine patient speech (no dialect rewrite)", () => {
    const levant =
      "والله تعبانة، ما بعرف شو بدي أحكي. القلق كتير وبنام عشر ساعات.";
    const out = prepareArabicSpeechText(levant);
    expect(out).toContain("والله تعبانة");
    expect(out).toContain("ما بعرف شو بدي أحكي");
    expect(out).toMatch(/عشر ساعات|عشرة ساعات/);
    expect(out).not.toMatch(/لا أعرف ماذا أريد/);
  });

  it("runs identify → correct pipeline for mixed clinical Arabic", () => {
    const result = prepareArabicSpeech(
      "صار عندي OCD من 3 سنوات وفي قلق كل يوم.",
    );
    expect(result.changed).toBe(true);
    expect(result.applied).toContain("identify");
    expect(result.applied).toContain("correct");
    expect(result.text).toContain("الوَسْوَاس القَهْرِي");
    expect(result.text).toContain("ثلاث سنوات");
    expect(result.text).toContain("قَلَق");
    expect(result.analysis).toBeDefined();
    expect(result.analysis!.abbreviations.length).toBeGreaterThan(0);
    expect(result.analysis!.numbers.length).toBeGreaterThan(0);
    expect(result.analysis!.medicalTerms.length).toBeGreaterThan(0);
    expect(result.analysis!.ttsRisks.length).toBeGreaterThan(0);
  });

  it("identifies all six finding categories before correcting", () => {
    const analysis = analyzeArabicSpeech(
      "ليان عندها OCD وقلق من 2 سنوات",
    );
    expect(analysis.names.some((f) => f.surface.includes("ليان"))).toBe(true);
    expect(analysis.abbreviations.some((f) => f.surface === "OCD")).toBe(true);
    expect(analysis.medicalTerms.some((f) => f.surface.includes("قلق"))).toBe(
      true,
    );
    expect(analysis.numbers.length).toBeGreaterThan(0);
    expect(analysis.ambiguities.length).toBeGreaterThan(0);
    expect(analysis.ttsRisks.length).toBeGreaterThan(0);
    expect(analysis.corrections.every((c) => c.suggested)).toBe(true);
  });

  it("strips emoji and markdown without touching clinical words", () => {
    const result = prepareArabicSpeech("**خايفة** من الانتحار 😢");
    expect(result.text).not.toMatch(/[*_]|😢/);
    expect(result.text).toContain("الانْتِحار");
    expect(result.text).toContain("خايفة");
  });

  it("strips English stage directions", () => {
    expect(prepareArabicSpeechText("مرحبا [laughs] كيفك")).toBe(
      "مرحبا كيفك",
    );
  });

  it("guides common avatar names", () => {
    const out = prepareArabicSpeechText("أنا ليان خوري من عمّان");
    expect(out).toContain("لِيان");
    expect(out).toContain("خُورِي");
  });

  it("prepareArabicSpeechText is a string convenience", () => {
    expect(typeof prepareArabicSpeechText("القلق")).toBe("string");
    expect(prepareArabicSpeechText("القلق")).toBe("القَلَق");
  });

  it("does not invent clinical content", () => {
    const raw = "بفكر أحياناً إني تعبانة.";
    const out = prepareArabicSpeechText(raw);
    expect(out).not.toMatch(/اكتئاب|تشخيص|اضطراب/);
    expect(out.length).toBeLessThanOrEqual(raw.length + 20);
  });

  it("outputs only speech-ready text from prepareArabicSpeechText", () => {
    const out = prepareArabicSpeechText(
      "القلق بخوفني وفي OCD من 3 أيام",
    );
    expect(out).not.toMatch(/ambiguity|medical|Finding|IPA|transliterat/i);
    expect(out).toContain("القَلَق");
    expect(out).toContain("الوَسْوَاس القَهْرِي");
    expect(out).toContain("ثلاثة أيام");
  });
});

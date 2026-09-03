import { describe, expect, it } from "vitest";
import {
  analyzeArabicSpeech,
  applyClinicalTashkeel,
  ASPE_PRONUNCIATION_CORPUS,
  containsArabicScript,
  expandArabicNumbers,
  expandClinicalAbbreviations,
  MEDICAL_SPEECH_DICTIONARY_VERSION,
  prepareArabicSpeech,
  prepareArabicSpeechText,
  SPEECH_NAME_DICTIONARY_VERSION,
} from "@/lib/arabic-speech";

describe("Arabic Speech Preparation Engine", () => {
  it("leaves pure English untouched", () => {
    const raw = "I feel anxious today.";
    const result = prepareArabicSpeech(raw);
    expect(result.changed).toBe(false);
    expect(result.text).toBe(raw);
  });

  it("handles empty and whitespace-only input", () => {
    expect(prepareArabicSpeech("").text).toBe("");
    expect(prepareArabicSpeech("   ").changed).toBe(false);
    expect(prepareArabicSpeech(undefined as unknown as string).text).toBe("");
  });
  it("detects Arabic script", () => {
    expect(containsArabicScript("مرحبا")).toBe(true);
    expect(containsArabicScript("hello")).toBe(false);
  });

  it("expands digit + unit patterns", () => {
    expect(expandArabicNumbers("3 أيام")).toBe("ثلاثة أيام");
    expect(expandArabicNumbers("2 مرات")).toBe("مرتين");
    expect(expandArabicNumbers("10 دقائق")).toBe("عشر دقائق");
    expect(expandArabicNumbers("١ جلسة")).toBe("جلسة واحدة");
    expect(expandArabicNumbers("١ يوم")).toBe("يوم واحد");
    expect(expandArabicNumbers("٢٠ يوم")).toBe("عشرون يوم");
    expect(expandArabicNumbers("21 يوم")).toBe("واحد وعشرون يوم");
    expect(expandArabicNumbers("100 ملغ")).toBe("مئة ملغ");
  });

  it("expands percentages, clock, and half doses", () => {
    expect(expandArabicNumbers("10%")).toBe("عشرة بالمئة");
    expect(expandArabicNumbers("الجرعة 25 ملغ")).toBe(
      "الجرعة خمسة وعشرون ملغ",
    );
    expect(expandArabicNumbers("باخذ 1.5 ملغ")).toBe("باخذ واحد ونصف ملغ");
    expect(expandArabicNumbers("بستيقظ الساعة 3")).toBe(
      "بستيقظ الساعة الثالثة",
    );
    expect(expandArabicNumbers("الساعة 12")).toBe("الساعة الثانية عشرة");
  });

  it("does not expand bare years without units", () => {
    expect(expandArabicNumbers("من ٢٠٢٥")).toBe("من ٢٠٢٥");
    expect(expandArabicNumbers("في 2024")).toBe("في 2024");
  });

  it("expands Latin clinical abbreviations", () => {
    expect(expandClinicalAbbreviations("عندي ADHD من زمان")).toContain(
      "اضطراب فرط الحركة وتشتت الانتباه",
    );
    expect(expandClinicalAbbreviations("يشبه OCD")).toContain(
      "الوَسْوَاس القَهْرِي",
    );
    expect(expandClinicalAbbreviations("بعد PTSD")).toContain(
      "اضطراب ما بعد الصدمة",
    );
    expect(expandClinicalAbbreviations("BPD")).toContain("الحَدِّيَّة");
  });

  it("applies selective clinical tashkeel without rewriting meaning", () => {
    expect(applyClinicalTashkeel("القلق بخوفني")).toBe("القَلَق بخوفني");
    expect(applyClinicalTashkeel("الفصام مو سهل")).toBe("الفُصَام مو سهل");
    expect(applyClinicalTashkeel("الذهان والهلوسة")).toBe(
      "الذُّهَان والهَلْوَسَة",
    );
    expect(applyClinicalTashkeel("اضطراب ثنائي القطب")).toContain(
      "ثُنَائِيِّ القُطْب",
    );
    expect(applyClinicalTashkeel("القَلَق")).toBe("القَلَق");
    expect(applyClinicalTashkeel("اضطراب الشخصية الحدية")).toContain(
      "الحَدِّيَّة",
    );
  });

  it("upgrades partial tashkeel (shadda-only) to full speech form", () => {
    // Regression: الحدّية must not block matching of BPD speech form.
    expect(prepareArabicSpeechText("عندي اضطراب الشخصية الحدّية")).toContain(
      "الحَدِّيَّة",
    );
    expect(applyClinicalTashkeel("اضطراب الشخصية الحدّية")).toContain(
      "الحَدِّيَّة",
    );
  });

  it("maps medication Latin names to Arabic speech forms", () => {
    expect(prepareArabicSpeechText("باخذ Sertraline")).toContain("سيرترالين");
    expect(prepareArabicSpeechText("Prozac ساعدني")).toContain("بروزاك");
  });

  it("preserves Levantine patient speech (no dialect rewrite)", () => {
    const levant =
      "والله تعبانة، ما بعرف شو بدي أحكي. القلق كتير وبنام عشر ساعات.";
    const out = prepareArabicSpeechText(levant);
    expect(out).toContain("والله تعبانة");
    expect(out).toContain("ما بعرف شو بدي أحكي");
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
    expect(result.analysis!.abbreviations.length).toBeGreaterThan(0);
    expect(result.analysis!.numbers.length).toBeGreaterThan(0);
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
  });

  it("strips emoji, markdown, and stage directions", () => {
    const result = prepareArabicSpeech("**خايفة** من الانتحار 😢");
    expect(result.text).not.toMatch(/[*_]|😢/);
    expect(result.text).toContain("الانْتِحار");
    expect(prepareArabicSpeechText("مرحبا [laughs] كيفك")).toBe(
      "مرحبا كيفك",
    );
  });

  it("guides only explicit catalog names; unknown names unchanged", () => {
    expect(prepareArabicSpeechText("أنا ليان خوري")).toContain("لِيان");
    expect(prepareArabicSpeechText("أنا سامي من الزرقاء")).toBe(
      "أنا سامي من الزرقاء",
    );
  });

  it("applies runtime speechNameOverrides (TTS only)", () => {
    const out = prepareArabicSpeechText("اسمي سامي", {
      speechNameOverrides: { سامي: "سامِي" },
    });
    expect(out).toContain("سامِي");
  });

  it("is idempotent for the same Arabic input", () => {
    const once = prepareArabicSpeechText("القلق و OCD من 3 أيام");
    const twice = prepareArabicSpeechText(once);
    expect(twice).toBe(once);
  });

  it("is deterministic across repeated calls", () => {
    const input = "الذهان والهلوسة مع نوبات الهلع";
    const a = prepareArabicSpeechText(input);
    const b = prepareArabicSpeechText(input);
    expect(a).toBe(b);
  });

  it("does not invent clinical content", () => {
    const raw = "بفكر أحياناً إني تعبانة.";
    const out = prepareArabicSpeechText(raw);
    expect(out).not.toMatch(/اكتئاب|تشخيص|اضطراب/);
  });

  it("does not translate Arabic into English", () => {
    const out = prepareArabicSpeechText("بخاف من الهلوسة");
    expect(out).not.toMatch(/hallucination|afraid|I am/i);
    expect(out).toContain("الهَلْوَسَة");
  });

  it("leaves English TTS path inputs unchanged when no Arabic/abbrev", () => {
    expect(prepareArabicSpeech("Hello therapist.").changed).toBe(false);
  });

  it("preserves punctuation rhythm markers", () => {
    const out = prepareArabicSpeechText("خايفة... القلق كتير؟");
    expect(out).toContain("...");
    expect(out).toContain("؟");
  });

  it("exposes versioned dictionaries", () => {
    expect(MEDICAL_SPEECH_DICTIONARY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(SPEECH_NAME_DICTIONARY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
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

  it("mixed Arabic/English keeps non-clinical English tokens", () => {
    const out = prepareArabicSpeechText("عندي deadline بكرة والقلق شديد");
    expect(out).toContain("deadline");
    expect(out).toContain("القَلَق");
  });

  it("does not fully vocalize every character (selective tashkeel)", () => {
    const out = prepareArabicSpeechText("تعبانة من الشغل والقلق");
    // colloquial words should not gain mechanical full tashkeel
    expect(out).toContain("تعبانة");
    expect(out).not.toMatch(/تَعْبَانَة/);
    expect(out).toContain("القَلَق");
  });
});

describe("ASPE pronunciation corpus", () => {
  it("contains all required corpus groups", () => {
    const groups = new Set(ASPE_PRONUNCIATION_CORPUS.map((c) => c.group));
    for (const g of [
      "general",
      "psychiatric",
      "patient",
      "levantine",
      "numbers",
      "names",
      "safety",
      "abbreviations",
    ] as const) {
      expect(groups.has(g)).toBe(true);
    }
    expect(ASPE_PRONUNCIATION_CORPUS.length).toBeGreaterThanOrEqual(40);
    expect(
      ASPE_PRONUNCIATION_CORPUS.some((c) => c.id === "pat-bipolar"),
    ).toBe(true);
  });

  for (const c of ASPE_PRONUNCIATION_CORPUS) {
    if (c.id === "name-runtime-override") continue; // exercised above with options
    it(`corpus ${c.id}`, () => {
      const result = prepareArabicSpeech(c.input);
      if (c.unchanged) {
        expect(result.text).toBe(c.input);
        return;
      }
      if (c.exact !== undefined) {
        expect(result.text).toBe(c.exact);
        return;
      }
      for (const s of c.mustInclude ?? []) {
        expect(result.text, `missing "${s}" in ${c.id}`).toContain(s);
      }
      for (const s of c.mustNotInclude ?? []) {
        expect(result.text, `unexpected "${s}" in ${c.id}`).not.toContain(s);
      }
    });
  }
});

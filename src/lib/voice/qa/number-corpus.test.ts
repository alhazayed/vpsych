import { describe, expect, it } from "vitest";
import {
  NUMBER_QA_CORPUS,
  NUMBER_QA_NUMERIC_PROBES,
  numberQaByCategory,
  type NumberQaCategory,
} from "@/lib/voice/qa/number-corpus";
import { prepareSpeech } from "@/lib/voice/speech-text";
import { normalizeArabicSpeech } from "@/lib/voice/speech-text/ar/normalize";

/**
 * Clinical-quantity integrity.
 *
 * These are the values where a wrong pronunciation is not merely unnatural but
 * clinically wrong: a dose, a frequency, a date, a decimal. The invariant is
 * the same one the speech layer carries everywhere — normalization may change
 * how a number is VOICED, never what it MEANS — but quantities are where a
 * silent change would do the most damage, and the existing Arabic corpus barely
 * covers them.
 *
 * The human listening pass is the actual QA; this suite pins the text side so a
 * regression is caught before anyone has to hear it.
 */

const REQUIRED_CATEGORIES: NumberQaCategory[] = [
  "age",
  "dose",
  "frequency",
  "date",
  "time",
  "duration",
  "symptom_frequency",
  "decimal",
  "percentage",
  "measurement",
];

describe("corpus shape", () => {
  it("covers every category the QA brief asks for", () => {
    for (const category of REQUIRED_CATEGORIES) {
      expect(numberQaByCategory(category).length, category).toBeGreaterThan(0);
    }
  });

  it("has unique ids and a stated clinical meaning for every entry", () => {
    const ids = NUMBER_QA_CORPUS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of NUMBER_QA_CORPUS) {
      expect(entry.clinicalMeaning.length, entry.id).toBeGreaterThan(0);
      expect(entry.mustPreserve.length, entry.id).toBeGreaterThan(0);
    }
  });

  it("includes every sentence named in the QA brief", () => {
    const spoken = NUMBER_QA_CORPUS.map((e) => e.spokenForm);
    for (const required of [
      "عمري خمسة وثلاثين سنة.",
      "باخذ خمسة وعشرين مليغرام من السيرترالين.",
      "باخذ خمسين مليغرام بالليل.",
      "باخذ مية مليغرام يومياً.",
      "النوبة بتستمر حوالي عشرين دقيقة.",
      "صارت معي النوبات مرتين أو ثلاث مرات بالأسبوع.",
      "بدأت الأعراض بتاريخ خمسة عشر سبعة.",
      "النوبة صارت الساعة عشرة ونص.",
      "وزني خمسة وسبعين كيلو.",
      "الجرعة اثنين ونصف مليغرام.",
    ]) {
      expect(spoken, required).toContain(required);
    }
  });
});

describe("normalization preserves clinical quantity", () => {
  it("keeps every stated quantity and unit in the spoken form", () => {
    for (const entry of NUMBER_QA_CORPUS) {
      const { text } = normalizeArabicSpeech(entry.spokenForm);
      for (const token of entry.mustPreserve) {
        expect(text, `${entry.id} lost "${token}"`).toContain(token);
      }
    }
  });

  it("never mutates the display text a numeric form was given as", () => {
    for (const entry of NUMBER_QA_CORPUS) {
      if (!entry.numericForm) continue;
      const frozen = String(entry.numericForm);
      prepareSpeech(entry.numericForm, "ar");
      expect(entry.numericForm, entry.id).toBe(frozen);
    }
  });

  it("is idempotent for every entry, spoken and numeric alike", () => {
    for (const entry of NUMBER_QA_CORPUS) {
      for (const source of [entry.spokenForm, entry.numericForm]) {
        if (!source) continue;
        const once = normalizeArabicSpeech(source).text;
        expect(normalizeArabicSpeech(once).text, entry.id).toBe(once);
      }
    }
  });
});

describe("numeric probes — the transformations most able to change meaning", () => {
  it("keeps a decimal dose intact rather than splitting it", () => {
    // "2.5" read as "2" and "5", or as "25", is a different prescription.
    const { text } = normalizeArabicSpeech("الجرعة 2.5 مغ.");
    expect(text).toContain("2.5");
    expect(text).not.toMatch(/2\s+5/);
  });

  it("keeps a clock time intact", () => {
    expect(normalizeArabicSpeech("الساعة 10:30.").text).toContain("10:30");
  });

  /**
   * KNOWN DEFECT — found by this corpus, deliberately left unfixed.
   *
   * A `d/m` date is not protected the way a decimal and a clock time are, so
   * the cardinal-spelling rule fires on each side independently and produces a
   * mixed, unspeakable form:
   *
   *   "بتاريخ 15/7."  → "بتاريخ 15/سبعة."     (digits slash word)
   *   "بتاريخ 3/7."   → "بتاريخ ثلاثة/سبعة."  (word slash word)
   *   "بتاريخ 15/12." → unchanged  (neither side is in the citation table)
   *   "الجرعة 1/2 حبة." → "الجرعة واحد/اثنين حبة."  (a half-tablet dose)
   *
   * Marked `.fails` rather than asserted loosely: the invariant below is the
   * correct one, fixing the normalizer is out of scope for this QA task, and
   * this test will flip to failing the moment someone does fix it — which is
   * the reminder to delete the `.fails` marker.
   */
  it.fails("keeps a day/month date intact rather than splitting it (KNOWN DEFECT)", () => {
    const { text } = normalizeArabicSpeech("بتاريخ 15/7.");
    expect(text).toContain("15/7");
  });

  it("documents the current day/month behaviour so a change is visible", () => {
    expect(normalizeArabicSpeech("بتاريخ 15/7.").text).toBe("بتاريخ 15/سبعة.");
    expect(normalizeArabicSpeech("بتاريخ 3/7.").text).toBe("بتاريخ ثلاثة/سبعة.");
    // Both sides outside the citation table survive, which is why the defect
    // was never noticed: it only bites on small day or month numbers.
    expect(normalizeArabicSpeech("بتاريخ 15/12.").text).toContain("15/12");
    // Never collapses into one number, at least — "157" would be far worse.
    expect(normalizeArabicSpeech("بتاريخ 15/7.").text).not.toContain("157");
  });

  it("spells a whole-number dose without dropping its unit", () => {
    for (const [source, quantity] of [
      ["باخذ 25 مغ.", "خمسة وعشرين"],
      ["باخذ 50 مغ.", "خمسين"],
      ["باخذ 100 مغ.", "مية"],
    ] as const) {
      const { text } = normalizeArabicSpeech(source);
      expect(text, source).toContain("ميليغرام");
      // The quantity must survive in some readable form — digits or words.
      expect(
        text.includes(quantity) || /\d/.test(text),
        `${source} lost its quantity`,
      ).toBe(true);
    }
  });

  it("does not silently drop any numeric probe", () => {
    for (const probe of NUMBER_QA_NUMERIC_PROBES) {
      const { text } = normalizeArabicSpeech(`القيمة ${probe}.`);
      const digits = probe.match(/\d+/g) ?? [];
      const survived = digits.some((d) => text.includes(d));
      expect(survived || text.length > "القيمة .".length, probe).toBe(true);
    }
  });
});

describe("segmentation never splits a quantity from its unit", () => {
  it("keeps number and unit inside one segment for every entry", () => {
    for (const entry of NUMBER_QA_CORPUS) {
      const prepared = prepareSpeech(entry.spokenForm, "ar");
      for (const token of entry.mustPreserve) {
        const inOneSegment = prepared.segments.some((s) =>
          s.text.includes(token),
        );
        expect(
          inOneSegment,
          `${entry.id}: "${token}" was split across segments`,
        ).toBe(true);
      }
    }
  });
});

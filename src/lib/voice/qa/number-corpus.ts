/**
 * Arabic clinical number QA corpus — DEVELOPMENT ONLY.
 *
 * Synthetic. No real patient text. Never imported by production code; the
 * guardrail suite asserts that.
 *
 * Existing `ARABIC_CORPUS` covers pronunciation and colloquial preservation but
 * not quantities: it has almost no doses, no frequencies, no dates, no times,
 * and no decimals. Those are the values where a mispronunciation is not merely
 * unnatural but clinically wrong — "خمسين مليغرام" heard as "خمسة عشر" is a
 * different prescription.
 *
 * Each entry carries the clinical fact that must survive normalization,
 * expressed as tokens rather than an exact expected string: the point is that
 * meaning is preserved, not that the normalizer produces one particular
 * spelling. `spokenForm` and `numericForm` are the same clinical fact written
 * both ways, so the tester can compare how each is voiced.
 */

export type NumberQaCategory =
  | "age"
  | "dose"
  | "frequency"
  | "date"
  | "time"
  | "duration"
  | "symptom_frequency"
  | "decimal"
  | "percentage"
  | "measurement";

export type NumberQaEntry = {
  id: string;
  category: NumberQaCategory;
  /** Written out in words, as the model usually produces it. */
  spokenForm: string;
  /** Same fact in digits/Latin units, to compare how each is voiced. */
  numericForm: string | null;
  /** What a clinician must hear. Plain English, for the human tester. */
  clinicalMeaning: string;
  /**
   * Substrings that must survive normalization of `spokenForm`. Quantity and
   * unit only — never the whole sentence.
   */
  mustPreserve: string[];
};

export const NUMBER_QA_CORPUS: NumberQaEntry[] = [
  {
    id: "num-age-01",
    category: "age",
    spokenForm: "عمري خمسة وثلاثين سنة.",
    numericForm: "عمري 35 سنة.",
    clinicalMeaning: "Age 35 years.",
    mustPreserve: ["خمسة وثلاثين", "سنة"],
  },
  {
    id: "num-dose-01",
    category: "dose",
    spokenForm: "باخذ خمسة وعشرين مليغرام من السيرترالين.",
    numericForm: "باخذ 25 mg من السيرترالين.",
    clinicalMeaning: "Sertraline 25 mg.",
    mustPreserve: ["خمسة وعشرين", "مليغرام", "السيرترالين"],
  },
  {
    id: "num-dose-02",
    category: "dose",
    spokenForm: "باخذ خمسين مليغرام بالليل.",
    numericForm: "باخذ 50 mg بالليل.",
    clinicalMeaning: "50 mg at night.",
    mustPreserve: ["خمسين", "مليغرام", "بالليل"],
  },
  {
    id: "num-dose-03",
    category: "dose",
    spokenForm: "باخذ مية مليغرام يومياً.",
    numericForm: "باخذ 100 mg يومياً.",
    clinicalMeaning: "100 mg daily.",
    mustPreserve: ["مية", "مليغرام", "يومياً"],
  },
  {
    id: "num-decimal-01",
    category: "decimal",
    spokenForm: "الجرعة اثنين ونصف مليغرام.",
    numericForm: "الجرعة 2.5 mg.",
    clinicalMeaning: "Dose 2.5 mg — must never be heard as 2 or as 25.",
    mustPreserve: ["اثنين ونصف", "مليغرام"],
  },
  {
    id: "num-freq-01",
    category: "frequency",
    spokenForm: "باخذ الحبة مرتين باليوم، الصبح وبالليل.",
    numericForm: "باخذ الحبة 2 مرات باليوم.",
    clinicalMeaning: "Twice daily, morning and night.",
    mustPreserve: ["مرتين", "باليوم"],
  },
  {
    id: "num-duration-01",
    category: "duration",
    spokenForm: "النوبة بتستمر حوالي عشرين دقيقة.",
    numericForm: "النوبة بتستمر حوالي 20 دقيقة.",
    clinicalMeaning: "Panic attack lasts about 20 minutes.",
    mustPreserve: ["عشرين", "دقيقة"],
  },
  {
    id: "num-symfreq-01",
    category: "symptom_frequency",
    spokenForm: "صارت معي النوبات مرتين أو ثلاث مرات بالأسبوع.",
    numericForm: "صارت معي النوبات 2 أو 3 مرات بالأسبوع.",
    clinicalMeaning: "Two to three attacks per week.",
    mustPreserve: ["مرتين", "ثلاث", "بالأسبوع"],
  },
  {
    id: "num-date-01",
    category: "date",
    spokenForm: "بدأت الأعراض بتاريخ خمسة عشر سبعة.",
    numericForm: "بدأت الأعراض بتاريخ 15/7.",
    clinicalMeaning: "Symptom onset 15 July — a day/month pair, not 157.",
    mustPreserve: ["خمسة عشر", "سبعة"],
  },
  {
    id: "num-time-01",
    category: "time",
    spokenForm: "النوبة صارت الساعة عشرة ونص.",
    numericForm: "النوبة صارت الساعة 10:30.",
    clinicalMeaning: "Attack at 10:30 — a clock time, not 'ten thirty'.",
    mustPreserve: ["عشرة ونص"],
  },
  {
    id: "num-measure-01",
    category: "measurement",
    spokenForm: "وزني خمسة وسبعين كيلو.",
    numericForm: "وزني 75 كيلو.",
    clinicalMeaning: "Weight 75 kg.",
    mustPreserve: ["خمسة وسبعين", "كيلو"],
  },
  {
    id: "num-pct-01",
    category: "percentage",
    spokenForm: "حسيت إني تحسنت عشرين بالمية بس.",
    numericForm: "حسيت إني تحسنت 20% بس.",
    clinicalMeaning: "20% improvement — a partial response.",
    mustPreserve: ["عشرين", "بالمية"],
  },
];

/** Numeric-only probes: the transformations most likely to change meaning. */
export const NUMBER_QA_NUMERIC_PROBES = [
  "25 mg",
  "50 mg",
  "100 mg",
  "2.5 mg",
  "10:30",
  "15/7",
] as const;

export function numberQaByCategory(
  category: NumberQaCategory,
): NumberQaEntry[] {
  return NUMBER_QA_CORPUS.filter((entry) => entry.category === category);
}

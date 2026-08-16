/**
 * Static benchmark corpus for TTS voice evaluation.
 *
 * EVERY LINE IS FICTIONAL. Nothing here is drawn from a real session, a real
 * patient, or any transcript. These are hand-authored utterances written to
 * exercise specific phonetic and prosodic properties, and they are safe to log,
 * diff, and share because they contain no PHI.
 *
 * The corpus is static and versioned in code precisely so benchmark runs are
 * comparable across providers, voices, and dates.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";

export type BenchmarkDimension =
  | "jordanian_colloquial"
  | "msa"
  | "arabic_consonants"
  | "medication_name"
  | "psychiatric_terminology"
  | "mixed_arabic_english"
  | "numbers"
  | "natural_pauses"
  | "hesitation"
  | "emotional_realism"
  | "sentence_rhythm";

export type BenchmarkTextCase = {
  /** Stable id — this, never the text, is what benchmark records reference. */
  id: string;
  locale: SessionSpeechLocale;
  label: string;
  text: string;
  /** What a reviewer should be listening for. */
  dimensions: BenchmarkDimension[];
  /** Clinical pause character, mirroring CVP `pause_scale` (1.0 = baseline). */
  pauseScale?: number;
  /** Clinical rate character, mirroring CVP `speech_rate` (1.0 = baseline). */
  speechRate?: number;
};

export const BENCHMARK_TEXTS: readonly BenchmarkTextCase[] = [
  // ── Arabic conversational ────────────────────────────────────────────
  {
    id: "ar-conv-01",
    locale: "ar",
    label: "Conversational — clinician opening question",
    text: "منذ متى وأنت تشعر بهذه الأعراض؟",
    dimensions: ["msa", "sentence_rhythm", "arabic_consonants"],
  },
  {
    id: "ar-conv-02",
    locale: "ar",
    label: "Conversational — Jordanian colloquial hesitation",
    text: "بصراحة، مش عارف كيف أشرحلك الموضوع.",
    dimensions: ["jordanian_colloquial", "hesitation", "natural_pauses"],
    pauseScale: 1.3,
  },
  {
    id: "ar-conv-03",
    locale: "ar",
    label: "Conversational — loss of self, long clause",
    text: "أنا من فترة طويلة مش حاسس إني نفس الشخص اللي كنت عليه.",
    dimensions: ["jordanian_colloquial", "emotional_realism", "sentence_rhythm"],
    pauseScale: 1.25,
    speechRate: 0.9,
  },

  // ── Anxiety ──────────────────────────────────────────────────────────
  {
    id: "ar-anxiety-01",
    locale: "ar",
    label: "Anxiety — persistent tension",
    text: "بحس إني متوتر طول الوقت، وحتى لما أكون بالبيت مش قادر أرتاح.",
    dimensions: [
      "jordanian_colloquial",
      "emotional_realism",
      "arabic_consonants",
      "sentence_rhythm",
    ],
    speechRate: 1.15,
  },

  // ── Depression ───────────────────────────────────────────────────────
  {
    id: "ar-depression-01",
    locale: "ar",
    label: "Depression — anhedonia",
    text: "ما عاد في إشي بفرحني مثل قبل، وحتى الأشياء اللي كنت أحبها بطلت تهمني.",
    dimensions: [
      "jordanian_colloquial",
      "emotional_realism",
      "natural_pauses",
      "sentence_rhythm",
    ],
    pauseScale: 1.7,
    speechRate: 0.8,
  },

  // ── Medication ───────────────────────────────────────────────────────
  {
    id: "ar-medication-01",
    locale: "ar",
    label: "Medication — sertraline adherence",
    text: "أنا حالياً باخذ سيرترالين، بس مش ملتزم فيه كل يوم.",
    dimensions: ["medication_name", "jordanian_colloquial", "arabic_consonants"],
  },

  // ── Psychiatric terminology ──────────────────────────────────────────
  {
    id: "ar-terminology-01",
    locale: "ar",
    label: "Terminology — generalized anxiety disorder",
    text: "الدكتور حكى لي إنه ممكن يكون عندي اضطراب القلق العام.",
    dimensions: [
      "psychiatric_terminology",
      "msa",
      "jordanian_colloquial",
      "arabic_consonants",
    ],
  },

  // ── Mixed Arabic / English ───────────────────────────────────────────
  {
    id: "ar-mixed-01",
    locale: "ar",
    label: "Code-switching — English clinical term inside Arabic",
    text: "بحس إنه عندي anxiety طول الوقت.",
    dimensions: ["mixed_arabic_english", "jordanian_colloquial"],
  },

  // ── Numbers ──────────────────────────────────────────────────────────
  {
    id: "ar-numbers-01",
    locale: "ar",
    label: "Numbers — symptom onset duration",
    text: "الأعراض بدأت تقريباً من ثلاثة أشهر.",
    dimensions: ["numbers", "msa", "sentence_rhythm"],
  },

  // ── Long response (fictional, ~20–30 seconds spoken) ─────────────────
  {
    id: "ar-long-01",
    locale: "ar",
    label: "Long patient response — fictional, ~20–30s",
    text:
      "من فترة، تقريباً من بداية الشتاء، صرت أصحى الساعة أربعة الفجر وما بقدر أرجع أنام. " +
      "بضل أفكر بأشياء صارت من زمان، وبحس إنه صدري ضيق ونفسي مش طالع منيح. " +
      "بروح على الشغل وأنا تعبان، وزملائي بسألوني إذا في إشي، وأنا بقلهم لا ما في إشي، " +
      "بس بصراحة في إشي. " +
      "أمي بتحكي إني تغيرت كثير، وإني بطلت أحكي معهم مثل قبل. " +
      "أنا مش عارف كيف أوصفلك الإحساس، بس كإنه في حاجز بيني وبين الناس، " +
      "وكل ما أحاول أشرح، بحس إنه الكلام بيضيع مني.",
    dimensions: [
      "jordanian_colloquial",
      "emotional_realism",
      "natural_pauses",
      "sentence_rhythm",
      "hesitation",
      "numbers",
    ],
    pauseScale: 1.5,
    speechRate: 0.88,
  },

  // ── English control group ────────────────────────────────────────────
  {
    id: "en-conv-01",
    locale: "en",
    label: "English control — clinician opening question",
    text: "How long have you been feeling this way?",
    dimensions: ["sentence_rhythm"],
  },
  {
    id: "en-depression-01",
    locale: "en",
    label: "English control — anhedonia with medication name",
    text:
      "Nothing really makes me happy anymore. I am on sertraline, but I do not take it every day.",
    dimensions: ["medication_name", "emotional_realism", "natural_pauses"],
    pauseScale: 1.6,
    speechRate: 0.85,
  },
] as const;

export function benchmarkTextsForLocale(
  locale: SessionSpeechLocale,
): BenchmarkTextCase[] {
  return BENCHMARK_TEXTS.filter((t) => t.locale === locale);
}

export function findBenchmarkText(id: string): BenchmarkTextCase | null {
  return BENCHMARK_TEXTS.find((t) => t.id === id) ?? null;
}

/** Every dimension the corpus claims to cover — asserted by tests. */
export function coveredDimensions(): Set<BenchmarkDimension> {
  const covered = new Set<BenchmarkDimension>();
  for (const t of BENCHMARK_TEXTS) {
    for (const d of t.dimensions) covered.add(d);
  }
  return covered;
}

/**
 * Google custom pronunciation dictionary — provider-local, benchmark-only.
 *
 * Maps phrases to explicit IPA so Chirp 3 HD says clinical vocabulary the way
 * a Jordanian clinician would. Google accepts these via
 * `SynthesisInput.custom_pronunciations` (IPA or X-SAMPA).
 *
 * HARD CONSTRAINTS:
 * - Provider-specific: nothing here leaves `lib/voice/google`.
 * - Never changes clinical meaning. A pronunciation entry changes *how* a
 *   phrase is voiced, never which words are spoken.
 * - No LLM. No ASPE involvement. No patient-agent involvement.
 * - Server-only: this module is imported by the server-side adapter and never
 *   reaches the browser bundle.
 * - No database. Deliberately a plain code table so it is trivially replaced
 *   by a `voice_pronunciations` table or a config layer later — every entry
 *   already carries the columns such a table would need.
 *
 * STATUS OF THE ENTRIES BELOW: every entry is marked `reviewed: false`. These
 * are BENCHMARK PLACEHOLDERS authored to exercise the mechanism, NOT validated
 * clinical pronunciations. A Jordanian-dialect clinician or linguist must
 * review them before any of this is considered for production.
 */

import { CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES } from "@/lib/voice/google/capabilities";

export type PhoneticEncoding = "PHONETIC_ENCODING_IPA" | "PHONETIC_ENCODING_X_SAMPA";

export type PronunciationCategory =
  | "psychiatric_terminology"
  | "medication_name"
  | "arabic_clinical_expression"
  | "english_in_arabic";

export type PronunciationEntry = {
  /** Exact phrase as it appears in dialogue. */
  phrase: string;
  /** Phonetic rendering in `encoding`. */
  pronunciation: string;
  encoding: PhoneticEncoding;
  /** BCP-47 locale this entry applies to. */
  locale: string;
  category: PronunciationCategory;
  /**
   * False for every entry today — see the module header. Only reviewed
   * entries should ever be promoted beyond benchmarking.
   */
  reviewed: boolean;
};

/** Google's request payload shape for one custom pronunciation. */
export type GoogleCustomPronunciation = {
  phrase: string;
  phoneticEncoding: PhoneticEncoding;
  pronunciation: string;
};

/** Bound the request payload — long dictionaries inflate every call. */
export const MAX_CUSTOM_PRONUNCIATIONS_PER_REQUEST = 12;
const MAX_PHRASE_LENGTH = 120;
const MAX_PRONUNCIATION_LENGTH = 200;
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * BENCHMARK PLACEHOLDER DICTIONARY — unreviewed. See module header.
 */
export const BENCHMARK_PRONUNCIATIONS: readonly PronunciationEntry[] = [
  // ── Psychiatric terminology (Arabic) ──────────────────────────────────
  {
    phrase: "اضطراب القلق العام",
    pronunciation: "idˤtˤiraːb alqalaq alʕaːm",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "psychiatric_terminology",
    reviewed: false,
  },
  {
    phrase: "نوبة هلع",
    pronunciation: "nawbat halaʕ",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "psychiatric_terminology",
    reviewed: false,
  },
  {
    phrase: "اكتئاب",
    pronunciation: "iktiʔaːb",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "psychiatric_terminology",
    reviewed: false,
  },
  // ── Medication names (transliterated into Arabic script) ──────────────
  {
    phrase: "سيرترالين",
    pronunciation: "seːrtraliːn",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "medication_name",
    reviewed: false,
  },
  {
    phrase: "فلوكستين",
    pronunciation: "fluːksitiːn",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "medication_name",
    reviewed: false,
  },
  {
    phrase: "إسيتالوبرام",
    pronunciation: "esitaːloːpraːm",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "medication_name",
    reviewed: false,
  },
  // ── Common Arabic clinical expressions (Levantine colloquial) ─────────
  {
    phrase: "مش قادر أرتاح",
    pronunciation: "miʃ ʔaːder artaːħ",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "arabic_clinical_expression",
    reviewed: false,
  },
  {
    phrase: "بصراحة",
    pronunciation: "bsˤaraːħa",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "arabic_clinical_expression",
    reviewed: false,
  },
  // ── English terms embedded in Arabic speech ───────────────────────────
  {
    phrase: "anxiety",
    pronunciation: "æŋˈzaɪəti",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "english_in_arabic",
    reviewed: false,
  },
  {
    phrase: "depression",
    pronunciation: "dɪˈpɹɛʃən",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "english_in_arabic",
    reviewed: false,
  },
  {
    phrase: "panic attack",
    pronunciation: "ˈpænɪk əˈtæk",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "ar-XA",
    category: "english_in_arabic",
    reviewed: false,
  },
  // ── English-locale clinical terminology ───────────────────────────────
  {
    phrase: "sertraline",
    pronunciation: "ˈsɜːrtrəliːn",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "en-US",
    category: "medication_name",
    reviewed: false,
  },
  {
    phrase: "anhedonia",
    pronunciation: "ˌænhiːˈdoʊniə",
    encoding: "PHONETIC_ENCODING_IPA",
    locale: "en-US",
    category: "psychiatric_terminology",
    reviewed: false,
  },
] as const;

/** Reject entries that would produce a malformed or unsafe request. */
export function isValidPronunciationEntry(
  entry: Partial<PronunciationEntry> | null | undefined,
): entry is PronunciationEntry {
  if (!entry) return false;
  const { phrase, pronunciation, encoding, locale } = entry;

  if (typeof phrase !== "string" || !phrase.trim()) return false;
  if (phrase.length > MAX_PHRASE_LENGTH) return false;
  if (CONTROL_CHARS.test(phrase)) return false;

  if (typeof pronunciation !== "string" || !pronunciation.trim()) return false;
  if (pronunciation.length > MAX_PRONUNCIATION_LENGTH) return false;
  if (CONTROL_CHARS.test(pronunciation)) return false;

  if (
    encoding !== "PHONETIC_ENCODING_IPA" &&
    encoding !== "PHONETIC_ENCODING_X_SAMPA"
  ) {
    return false;
  }

  if (typeof locale !== "string" || !locale.trim()) return false;

  return true;
}

/** Is this locale eligible for custom pronunciations at all? */
export function localeSupportsCustomPronunciation(languageCode: string): boolean {
  return !CUSTOM_PRONUNCIATION_EXCLUDED_LOCALES.includes(
    languageCode.trim().toLowerCase(),
  );
}

export type ResolvedPronunciations = {
  pronunciations: GoogleCustomPronunciation[];
  /** Entries dropped because they failed validation. */
  invalidCount: number;
  /** True when the dictionary was truncated to the per-request cap. */
  truncated: boolean;
};

/**
 * Select the dictionary entries worth sending for one utterance.
 *
 * Only phrases that actually occur in the text are included — sending the whole
 * dictionary on every turn would inflate the payload and the cache key for no
 * benefit. Matching is a literal substring test on the already-normalized text;
 * no regex is built from dictionary content, and the text itself is never
 * modified by this function.
 */
export function customPronunciationsFor(params: {
  text: string;
  languageCode: string;
  dictionary?: readonly PronunciationEntry[];
}): ResolvedPronunciations {
  const dictionary = params.dictionary ?? BENCHMARK_PRONUNCIATIONS;
  const locale = params.languageCode.trim().toLowerCase();

  if (!localeSupportsCustomPronunciation(locale)) {
    return { pronunciations: [], invalidCount: 0, truncated: false };
  }

  const pronunciations: GoogleCustomPronunciation[] = [];
  let invalidCount = 0;
  let truncated = false;

  for (const entry of dictionary) {
    if (!isValidPronunciationEntry(entry)) {
      invalidCount += 1;
      continue;
    }
    if (entry.locale.trim().toLowerCase() !== locale) continue;
    if (!params.text.includes(entry.phrase)) continue;

    if (pronunciations.length >= MAX_CUSTOM_PRONUNCIATIONS_PER_REQUEST) {
      truncated = true;
      break;
    }

    pronunciations.push({
      phrase: entry.phrase,
      phoneticEncoding: entry.encoding,
      pronunciation: entry.pronunciation,
    });
  }

  return { pronunciations, invalidCount, truncated };
}

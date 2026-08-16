import { describe, expect, it } from "vitest";
import {
  BENCHMARK_PRONUNCIATIONS,
  customPronunciationsFor,
  isValidPronunciationEntry,
  localeSupportsCustomPronunciation,
  MAX_CUSTOM_PRONUNCIATIONS_PER_REQUEST,
  type PronunciationEntry,
} from "@/lib/voice/google/pronunciation";

const VALID: PronunciationEntry = {
  phrase: "سيرترالين",
  pronunciation: "seːrtraliːn",
  encoding: "PHONETIC_ENCODING_IPA",
  locale: "ar-XA",
  category: "medication_name",
  reviewed: false,
};

describe("benchmark dictionary integrity", () => {
  it("every shipped entry is valid", () => {
    for (const entry of BENCHMARK_PRONUNCIATIONS) {
      expect(isValidPronunciationEntry(entry), entry.phrase).toBe(true);
    }
  });

  it("every shipped entry is marked unreviewed — these are placeholders", () => {
    // Guards against a placeholder silently being treated as clinical content.
    for (const entry of BENCHMARK_PRONUNCIATIONS) {
      expect(entry.reviewed, entry.phrase).toBe(false);
    }
  });

  it("covers each required benchmark category", () => {
    const categories = new Set(BENCHMARK_PRONUNCIATIONS.map((e) => e.category));
    expect(categories).toContain("psychiatric_terminology");
    expect(categories).toContain("medication_name");
    expect(categories).toContain("arabic_clinical_expression");
    expect(categories).toContain("english_in_arabic");
  });

  it("has no duplicate phrase+locale pairs", () => {
    const seen = new Set<string>();
    for (const entry of BENCHMARK_PRONUNCIATIONS) {
      const key = `${entry.locale}:${entry.phrase}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });
});

describe("isValidPronunciationEntry — malformed entries", () => {
  it("accepts a well-formed entry", () => {
    expect(isValidPronunciationEntry(VALID)).toBe(true);
  });

  it("rejects empty or whitespace-only phrases", () => {
    expect(isValidPronunciationEntry({ ...VALID, phrase: "" })).toBe(false);
    expect(isValidPronunciationEntry({ ...VALID, phrase: "   " })).toBe(false);
  });

  it("rejects an empty pronunciation", () => {
    expect(isValidPronunciationEntry({ ...VALID, pronunciation: "" })).toBe(false);
  });

  it("rejects an unknown phonetic encoding", () => {
    expect(
      isValidPronunciationEntry({
        ...VALID,
        encoding: "PHONETIC_ENCODING_KLINGON" as never,
      }),
    ).toBe(false);
  });

  it("rejects control characters in either field", () => {
    expect(
      isValidPronunciationEntry({ ...VALID, phrase: "bad\u0007phrase" }),
    ).toBe(false);
    expect(
      isValidPronunciationEntry({ ...VALID, pronunciation: "ba\u0000d" }),
    ).toBe(false);
  });

  it("rejects oversized fields", () => {
    expect(
      isValidPronunciationEntry({ ...VALID, phrase: "ب".repeat(500) }),
    ).toBe(false);
    expect(
      isValidPronunciationEntry({ ...VALID, pronunciation: "a".repeat(500) }),
    ).toBe(false);
  });

  it("rejects null, undefined, and a missing locale", () => {
    expect(isValidPronunciationEntry(null)).toBe(false);
    expect(isValidPronunciationEntry(undefined)).toBe(false);
    expect(isValidPronunciationEntry({ ...VALID, locale: "" })).toBe(false);
  });
});

describe("localeSupportsCustomPronunciation", () => {
  it("allows ar-XA and en-US", () => {
    expect(localeSupportsCustomPronunciation("ar-XA")).toBe(true);
    expect(localeSupportsCustomPronunciation("en-US")).toBe(true);
  });

  it("rejects locales Google excludes", () => {
    expect(localeSupportsCustomPronunciation("th-TH")).toBe(false);
    expect(localeSupportsCustomPronunciation("sv-SE")).toBe(false);
    expect(localeSupportsCustomPronunciation("yue-HK")).toBe(false);
  });
});

describe("customPronunciationsFor", () => {
  it("includes only phrases that actually occur in the text", () => {
    const result = customPronunciationsFor({
      text: "أنا حالياً باخذ سيرترالين، بس مش ملتزم فيه كل يوم.",
      languageCode: "ar-XA",
    });
    const phrases = result.pronunciations.map((p) => p.phrase);
    expect(phrases).toContain("سيرترالين");
    // Not mentioned in this utterance.
    expect(phrases).not.toContain("فلوكستين");
    expect(phrases).not.toContain("nomatch");
  });

  it("matches an English term embedded in Arabic", () => {
    const result = customPronunciationsFor({
      text: "بحس إنه عندي anxiety طول الوقت.",
      languageCode: "ar-XA",
    });
    expect(result.pronunciations.map((p) => p.phrase)).toContain("anxiety");
  });

  it("matches multi-word Arabic psychiatric terminology", () => {
    const result = customPronunciationsFor({
      text: "الدكتور حكى لي إنه ممكن يكون عندي اضطراب القلق العام.",
      languageCode: "ar-XA",
    });
    expect(result.pronunciations.map((p) => p.phrase)).toContain(
      "اضطراب القلق العام",
    );
  });

  it("emits Google's payload shape", () => {
    const result = customPronunciationsFor({
      text: "أنا باخذ سيرترالين.",
      languageCode: "ar-XA",
    });
    expect(result.pronunciations[0]).toEqual({
      phrase: "سيرترالين",
      phoneticEncoding: "PHONETIC_ENCODING_IPA",
      pronunciation: "seːrtraliːn",
    });
  });

  it("does not leak entries across locales", () => {
    const result = customPronunciationsFor({
      // The Arabic-locale dictionary has an "anxiety" entry; the en-US one does not.
      text: "I have anxiety all the time.",
      languageCode: "en-US",
    });
    expect(result.pronunciations.map((p) => p.phrase)).not.toContain("anxiety");
  });

  it("returns nothing for a locale Google excludes", () => {
    const result = customPronunciationsFor({
      text: "سيرترالين",
      languageCode: "th-TH",
    });
    expect(result.pronunciations).toEqual([]);
  });

  it("counts malformed dictionary entries instead of sending them", () => {
    const result = customPronunciationsFor({
      text: "hello world",
      languageCode: "en-US",
      dictionary: [
        { ...VALID, phrase: "", locale: "en-US" },
        { ...VALID, phrase: "hello", pronunciation: "", locale: "en-US" },
        {
          phrase: "hello",
          pronunciation: "həˈloʊ",
          encoding: "PHONETIC_ENCODING_IPA",
          locale: "en-US",
          category: "psychiatric_terminology",
          reviewed: false,
        },
      ],
    });
    expect(result.invalidCount).toBe(2);
    expect(result.pronunciations).toHaveLength(1);
    expect(result.pronunciations[0]!.phrase).toBe("hello");
  });

  it("truncates at the per-request cap", () => {
    const phrase = "term";
    const dictionary: PronunciationEntry[] = Array.from(
      { length: MAX_CUSTOM_PRONUNCIATIONS_PER_REQUEST + 5 },
      (_, i) => ({
        phrase: `${phrase}${i}`,
        pronunciation: "tɜːm",
        encoding: "PHONETIC_ENCODING_IPA" as const,
        locale: "en-US",
        category: "psychiatric_terminology" as const,
        reviewed: false,
      }),
    );
    const text = dictionary.map((d) => d.phrase).join(" ");

    const result = customPronunciationsFor({
      text,
      languageCode: "en-US",
      dictionary,
    });
    expect(result.pronunciations).toHaveLength(
      MAX_CUSTOM_PRONUNCIATIONS_PER_REQUEST,
    );
    expect(result.truncated).toBe(true);
  });

  it("never modifies the text it is given", () => {
    const text = "أنا حالياً باخذ سيرترالين، بس مش ملتزم فيه كل يوم.";
    customPronunciationsFor({ text, languageCode: "ar-XA" });
    expect(text).toBe("أنا حالياً باخذ سيرترالين، بس مش ملتزم فيه كل يوم.");
  });
});

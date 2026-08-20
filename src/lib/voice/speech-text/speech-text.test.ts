import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AR_PROTECTED_COLLOQUIAL,
  normalizeArabicSpeech,
  normalizeEnglishSpeech,
  normalizeSpeechText,
  prepareSpeech,
} from "@/lib/voice/speech-text";
import {
  ARABIC_CORPUS,
  ENGLISH_CORPUS,
  SPEECH_CORPUS,
} from "@/lib/voice/speech-text/corpus";

describe("Arabic speech normalization", () => {
  it("maps Arabic punctuation onto ASCII for prosody", () => {
    const { text } = normalizeArabicSpeech("ليش صار هيك؟ ما بعرف، والله؛ خلص.");
    expect(text).toContain("?");
    expect(text).toContain(",");
    expect(text).toContain(";");
    expect(text).not.toMatch(/[؟،؛]/);
  });

  it("converts Arabic-Indic digits and spells unambiguous cardinals", () => {
    expect(normalizeArabicSpeech("من ٣ شهور.").text).toContain("ثلاثة");
    expect(normalizeArabicSpeech("بعمر ٢٠.").text).toContain("عشرين");
    expect(normalizeArabicSpeech("أخذت ١٠٠٠ مغ.").text).toContain("ألف");
  });

  it("leaves compound numbers intact rather than spelling them piecewise", () => {
    expect(normalizeArabicSpeech("الجرعة 2.5 حبة.").text).toContain("2.5");
    expect(normalizeArabicSpeech("الساعة 10:30.").text).toContain("10:30");
    // A year is outside the citation table and stays as digits.
    expect(normalizeArabicSpeech("من ٢٠١٩.").text).toContain("2019");
  });

  it("transliterates medication names and clinical acronyms", () => {
    expect(normalizeArabicSpeech("وصفلي Prozac.").text).toContain("بروزاك");
    expect(normalizeArabicSpeech("عندي OCD.").text).toContain("أو سي دي");
    expect(normalizeArabicSpeech("جربت CBT.").text).toContain("سي بي تي");
    expect(normalizeArabicSpeech("من Zoloft على Lexapro.").text).toContain(
      "زولوفت",
    );
  });

  it("reattaches the definite article after tatweel removal", () => {
    const { text } = normalizeArabicSpeech("راجعت الـ PTSD مرتين.");
    expect(text).toContain("البي تي إس دي");
    expect(text).not.toMatch(/(^|\s)ال\s/);
  });

  it("expands the small abbreviation set without touching similar words", () => {
    expect(normalizeArabicSpeech("د. سامي حولني.").text).toContain("دكتور سامي");
    // "الدكتور" must not be mangled by the "د." rule.
    expect(normalizeArabicSpeech("الدكتور وصفلي دوا.").text).toContain(
      "الدكتور",
    );
    expect(normalizeArabicSpeech("٥٠ مغ.").text).toContain("ميليغرام");
  });

  it("restores gemination without changing the word", () => {
    expect(normalizeArabicSpeech("بدي أروح.").text).toContain("بدّي");
    expect(normalizeArabicSpeech("هسه تعبت.").text).toContain("هسّه");
    expect(normalizeArabicSpeech("ما بديش أحكي.").text).toContain("بدّيش");
  });

  it("strips stage directions and invisible characters", () => {
    expect(normalizeArabicSpeech("*تنهيدة* أنا تعبت.").text).not.toContain("*");
    expect(normalizeArabicSpeech("تعبت​‏.").text).not.toMatch(
      /[​‏]/,
    );
  });

  it("preserves ellipsis as a hesitation cue", () => {
    expect(normalizeArabicSpeech("يعني... ما بعرف.").text).toContain("...");
  });

  it("never converts Jordanian colloquial vocabulary into MSA", () => {
    const source = `شو بدّي أحكي؟ ليش هيك؟ كتير تعبت، مش قادر. هسّه يعني طيب، بصراحة منيح. يا زلمة لسا.`;
    const { text } = normalizeArabicSpeech(source);
    for (const word of AR_PROTECTED_COLLOQUIAL) {
      expect(text).toContain(word);
    }
  });

  it("is idempotent — normalizing twice changes nothing further", () => {
    for (const entry of ARABIC_CORPUS) {
      const once = normalizeArabicSpeech(entry.text).text;
      const twice = normalizeArabicSpeech(once).text;
      expect(twice, entry.id).toBe(once);
    }
  });
});

describe("English speech normalization (regression guard)", () => {
  it("is identity for every sentence in the English corpus", () => {
    for (const entry of ENGLISH_CORPUS) {
      const result = normalizeEnglishSpeech(entry.text);
      expect(result.text, entry.id).toBe(entry.text);
      expect(result.changed, entry.id).toBe(false);
    }
  });

  it("does not touch English punctuation or contractions", () => {
    const source = "I don't know — maybe six months? It's hard to say.";
    expect(normalizeEnglishSpeech(source).text).toBe(source);
  });

  it("removes asterisk markers without deleting the enclosed words", () => {
    // Previously asserted whole-span deletion ("I'm tired."). That behaviour was
    // a reproduced clinical-semantic defect: the layer cannot distinguish a
    // stage direction from emphasis, so `I am *not* okay.` lost its negation.
    // Markers must not reach TTS; content must never be deleted.
    // See clinical-integrity.test.ts.
    expect(normalizeEnglishSpeech("*sighs* I'm tired.").text).toBe(
      "sighs I'm tired.",
    );
    expect(normalizeEnglishSpeech("*sighs* I'm tired.").text).not.toContain("*");
    expect(normalizeEnglishSpeech("I am *not* okay.").text).toBe(
      "I am not okay.",
    );
  });

  it("is idempotent", () => {
    for (const entry of ENGLISH_CORPUS) {
      const once = normalizeEnglishSpeech(entry.text).text;
      expect(normalizeEnglishSpeech(once).text, entry.id).toBe(once);
    }
  });
});

describe("language router", () => {
  it("routes on session locale, never on the text content", () => {
    // Arabic text forced through the English pipeline stays untouched, proving
    // routing is not driven by script sniffing.
    const arabic = "عندي ٣ ولاد؟";
    expect(normalizeSpeechText(arabic, "en").text).toBe(arabic);
    expect(normalizeSpeechText(arabic, "ar").text).not.toBe(arabic);
  });

  it("accepts BCP-47 tags", () => {
    expect(normalizeSpeechText("من ٣ شهور.", "ar-JO").text).toContain("ثلاثة");
    expect(normalizeSpeechText("Six months.", "en-US").text).toBe("Six months.");
  });
});

describe("display / speech separation", () => {
  it("never mutates the display text it is given", () => {
    for (const entry of SPEECH_CORPUS) {
      const display = entry.text;
      const frozen = String(display);
      prepareSpeech(display, entry.locale);
      expect(display, entry.id).toBe(frozen);
    }
  });

  it("returns a speech representation distinct from display where needed", () => {
    const display = "الدكتور وصفلي Prozac من ٣ شهور؟";
    const prepared = prepareSpeech(display, "ar");
    expect(prepared.normalized).toBe(true);
    expect(prepared.speechText).not.toBe(display);
    // The transcript-facing value is the caller's own string, unchanged.
    expect(display).toBe("الدكتور وصفلي Prozac من ٣ شهور؟");
  });

  it("prepareSpeech is pure — repeated calls give identical output", () => {
    const display = "يعني... بصراحة ما بعرف، بدي أفكر.";
    const a = prepareSpeech(display, "ar");
    const b = prepareSpeech(display, "ar");
    expect(b.speechText).toBe(a.speechText);
    expect(b.segments).toEqual(a.segments);
  });
});

describe("corpus isolation", () => {
  it("is imported only by tests and the manual evaluation script", () => {
    // The corpus is synthetic. If production code ever imports it, that is a
    // route for test sentences to reach clinical data.
    const importers = [
      "src/lib/voice/speech-text/index.ts",
      "src/lib/voice/speech-text/router.ts",
      "src/lib/voice/speech-text/segment.ts",
      "src/lib/voice/speech-text/ar/normalize.ts",
      "src/lib/voice/speech-text/en/normalize.ts",
      "src/lib/voice/conversation-pipeline.ts",
      "src/lib/voice/client.ts",
      "src/app/api/voice/tts/route.ts",
    ];
    for (const file of importers) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toContain("speech-text/corpus");
    }
  });

  it("covers every required category", () => {
    expect(ARABIC_CORPUS.length).toBe(40);
    expect(ENGLISH_CORPUS.length).toBe(10);
    const ids = SPEECH_CORPUS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

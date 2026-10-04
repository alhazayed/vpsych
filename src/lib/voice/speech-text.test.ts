import { describe, expect, it } from "vitest";
import { arabicNumberWords, prepareTextForSpeech } from "@/lib/voice/speech-text";

describe("arabicNumberWords", () => {
  it.each([
    [0, "صفر"],
    [3, "ثلاثة"],
    [11, "أحد عشر"],
    [20, "عشرين"],
    [25, "خمسة وعشرين"],
    [100, "مئة"],
    [200, "مئتين"],
    [345, "ثلاثمئة وخمسة وأربعين"],
    [1000, "ألف"],
    [2019, "ألفين وتسعة عشر"],
    [5000, "خمسة آلاف"],
    [15000, "خمسة عشر ألف"],
  ])("%i → %s", (n, words) => {
    expect(arabicNumberWords(n)).toBe(words);
  });

  it("leaves very large numbers alone", () => {
    expect(arabicNumberWords(1_000_000)).toBeNull();
  });
});

describe("prepareTextForSpeech", () => {
  it("spells Western and Arabic-Indic digits as Arabic words", () => {
    expect(prepareTextForSpeech("عمري 34 سنة", "ar")).toBe(
      "عمري أربعة وثلاثين سنة",
    );
    expect(prepareTextForSpeech("صارلي ٣ أسابيع", "ar")).toBe(
      "صارلي ثلاثة أسابيع",
    );
  });

  it("handles percent, decimals and thousands separators in Arabic", () => {
    expect(prepareTextForSpeech("تقريباً 50% من الوقت", "ar")).toBe(
      "تقريباً خمسين بالمئة من الوقت",
    );
    expect(prepareTextForSpeech("نمت 2.5 ساعة", "ar")).toBe(
      "نمت اثنين فاصلة خمسة ساعة",
    );
    expect(prepareTextForSpeech("دفعت 1,200 دينار", "ar")).toBe(
      "دفعت ألف ومئتين دينار",
    );
  });

  it("keeps digits glued to Latin letters", () => {
    expect(prepareTextForSpeech("أخذت فيتامين B12", "ar")).toBe(
      "أخذت فيتامين B12",
    );
  });

  it("removes tatweel in Arabic", () => {
    expect(prepareTextForSpeech("تعبـــان كثيـر", "ar")).toBe("تعبان كثير");
  });

  it("drops stage directions, emphasis and emoji in every locale", () => {
    expect(prepareTextForSpeech("*يتنهد* ما بعرف 😔", "ar")).toBe("ما بعرف");
    expect(prepareTextForSpeech("[pause] I just **can't** sleep.", "en")).toBe(
      "I just can't sleep.",
    );
  });

  it("does not touch numbers in English", () => {
    expect(prepareTextForSpeech("I'm 34.", "en")).toBe("I'm 34.");
  });

  it("falls back to the original when cleaning leaves nothing", () => {
    expect(prepareTextForSpeech("*sighs*", "en")).toBe("*sighs*");
  });
});

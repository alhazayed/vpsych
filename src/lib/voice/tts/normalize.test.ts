import { describe, expect, it } from "vitest";
import { normalizeTtsText, utf8ByteLength } from "@/lib/voice/tts/normalize";

describe("utf8ByteLength", () => {
  it("counts Arabic at ~2 bytes per character, not 1", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("مرحبا")).toBe(10);
    expect("مرحبا".length).toBe(5);
  });
});

describe("normalizeTtsText", () => {
  it("preserves Arabic clinical wording exactly", () => {
    const arabic = "أشعر بالقلق طوال الوقت، ولا أستطيع النوم.";
    expect(normalizeTtsText(arabic).text).toBe(arabic);
  });

  it("preserves Arabic diacritics and does not fold hamza or alef", () => {
    const vocalized = "إنَّني أَشعُرُ بالضِّيق";
    expect(normalizeTtsText(vocalized).text).toBe(vocalized);
  });

  it("preserves English clinical wording exactly", () => {
    const english = "I can't sleep, and I keep thinking it's my fault.";
    expect(normalizeTtsText(english).text).toBe(english);
  });

  it("collapses runs of spaces and tabs into one space", () => {
    expect(normalizeTtsText("I  feel \t  tired").text).toBe("I feel tired");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeTtsText("  \n hello \n  ").text).toBe("hello");
  });

  it("keeps a single newline and collapses 3+ into a paragraph break", () => {
    expect(normalizeTtsText("one\ntwo").text).toBe("one\ntwo");
    expect(normalizeTtsText("one\n\n\n\ntwo").text).toBe("one\n\ntwo");
  });

  it("normalizes CRLF without dropping the break", () => {
    expect(normalizeTtsText("one\r\ntwo").text).toBe("one\ntwo");
  });

  it("strips zero-width, bidi, and control characters", () => {
    const dirty =
      "he\u200bllo\u200f wor\u0007ld\ufeff";
    expect(normalizeTtsText(dirty).text).toBe("hello world");
  });

  it("reports the UTF-8 byte length of the normalized text", () => {
    const result = normalizeTtsText("  مرحبا  ");
    expect(result.text).toBe("مرحبا");
    expect(result.bytes).toBe(10);
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(normalizeTtsText("   \n\t ").text).toBe("");
    expect(normalizeTtsText("   ").bytes).toBe(0);
  });

  it("does not reorder, translate, or truncate words", () => {
    const utterance = "لا أريد أن أتحدث عن أمي اليوم";
    const result = normalizeTtsText(utterance);
    expect(result.text.split(" ")).toEqual(utterance.split(" "));
  });
});

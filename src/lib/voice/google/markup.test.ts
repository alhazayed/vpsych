import { describe, expect, it } from "vitest";
import {
  buildPauseMarkup,
  escapeGoogleMarkup,
  pauseTagForScale,
} from "@/lib/voice/google/markup";

describe("escapeGoogleMarkup — injection safety", () => {
  it("leaves text without brackets untouched", () => {
    const text = "أشعر بالقلق طوال الوقت.";
    expect(escapeGoogleMarkup(text)).toEqual({ text, sanitized: false });
  });

  it("neutralizes a pause tag injected through clinical content", () => {
    const hostile = "I feel fine [pause long] actually I do not.";
    const result = escapeGoogleMarkup(hostile);
    expect(result.sanitized).toBe(true);
    expect(result.text).toBe("I feel fine (pause long) actually I do not.");
    expect(result.text).not.toContain("[");
    expect(result.text).not.toContain("]");
  });

  it("neutralizes bracket injection inside Arabic dialogue", () => {
    const hostile = "بحس إني متوتر [pause long] طول الوقت.";
    const result = escapeGoogleMarkup(hostile);
    expect(result.text).not.toMatch(/\[|\]/);
    // Arabic words themselves are untouched.
    expect(result.text).toContain("بحس إني متوتر");
    expect(result.text).toContain("طول الوقت.");
  });

  it("neutralizes unbalanced and repeated brackets", () => {
    expect(escapeGoogleMarkup("a [ b ] c [[ d").text).toBe("a ( b ) c (( d");
  });
});

describe("pauseTagForScale", () => {
  it("maps clinical pause_scale onto Google's tags", () => {
    expect(pauseTagForScale(1.7)).toBe("[pause long]");
    expect(pauseTagForScale(1.6)).toBe("[pause long]");
    expect(pauseTagForScale(1.3)).toBe("[pause short]");
    expect(pauseTagForScale(1.2)).toBe("[pause short]");
  });

  it("returns null at or near baseline so natural prosody is left alone", () => {
    expect(pauseTagForScale(1)).toBeNull();
    expect(pauseTagForScale(1.1)).toBeNull();
    expect(pauseTagForScale(0.8)).toBeNull();
  });

  it("returns null for missing or non-finite values", () => {
    expect(pauseTagForScale(null)).toBeNull();
    expect(pauseTagForScale(undefined)).toBeNull();
    expect(pauseTagForScale(Number.NaN)).toBeNull();
  });
});

describe("buildPauseMarkup", () => {
  it("adds nothing when disabled, but still sanitizes", () => {
    const result = buildPauseMarkup({
      text: "one. two. [pause long] three.",
      pauseScale: 1.8,
      enabled: false,
    });
    expect(result.applied).toBe(false);
    expect(result.tagCount).toBe(0);
    expect(result.text).not.toContain("[");
    expect(result.sanitized).toBe(true);
  });

  it("adds nothing when the clinical pause is at baseline", () => {
    const result = buildPauseMarkup({
      text: "one. two. three.",
      pauseScale: 1,
      enabled: true,
    });
    expect(result.applied).toBe(false);
    expect(result.text).toBe("one. two. three.");
  });

  it("inserts tags at sentence boundaries only", () => {
    const result = buildPauseMarkup({
      text: "First sentence. Second sentence. Third.",
      pauseScale: 1.7,
      enabled: true,
    });
    expect(result.applied).toBe(true);
    expect(result.tag).toBe("[pause long]");
    // Two internal boundaries; the trailing sentence gets no pause.
    expect(result.tagCount).toBe(2);
    expect(result.text).toBe(
      "First sentence. [pause long] Second sentence. [pause long] Third.",
    );
  });

  it("preserves every word and all punctuation", () => {
    const source = "First sentence. Second sentence. Third.";
    const result = buildPauseMarkup({
      text: source,
      pauseScale: 1.3,
      enabled: true,
    });
    const stripped = result.text.replace(/\[pause (short|long)\] /g, "");
    expect(stripped).toBe(source);
  });

  it("handles Arabic sentence boundaries including the Arabic question mark", () => {
    const result = buildPauseMarkup({
      text: "منذ متى وأنت تشعر بهذه الأعراض؟ بصراحة، مش عارف. ما بعرف.",
      pauseScale: 1.7,
      enabled: true,
    });
    expect(result.tagCount).toBe(2);
    expect(result.text).toContain("الأعراض؟ [pause long] بصراحة");
    // The Arabic comma is not a sentence boundary.
    expect(result.text).toContain("بصراحة، مش عارف.");
  });

  it("does not treat the Arabic comma as a boundary", () => {
    const result = buildPauseMarkup({
      text: "بحس إني متوتر، وحتى لما أكون بالبيت مش قادر أرتاح.",
      pauseScale: 1.7,
      enabled: true,
    });
    expect(result.tagCount).toBe(0);
    expect(result.applied).toBe(false);
  });

  it("does not split words or insert mid-sentence", () => {
    const result = buildPauseMarkup({
      text: "الأعراض بدأت تقريباً من ثلاثة أشهر. وبعدين صارت أسوأ.",
      pauseScale: 1.7,
      enabled: true,
    });
    expect(result.text).toContain("ثلاثة أشهر. [pause long] وبعدين");
    expect(result.text).toContain("أسوأ.");
  });

  it("sanitizes before inserting so injected tags cannot survive", () => {
    const result = buildPauseMarkup({
      text: "I am fine [pause long] really. Second sentence. Third.",
      pauseScale: 1.7,
      enabled: true,
    });
    // Exactly the tags we inserted — the injected one became parentheses.
    expect(result.text.match(/\[pause long\]/g)?.length).toBe(2);
    expect(result.text).toContain("(pause long)");
    expect(result.sanitized).toBe(true);
  });

  it("bounds the number of tags on pathological input", () => {
    const many = "a. ".repeat(200);
    const result = buildPauseMarkup({
      text: many,
      pauseScale: 1.9,
      enabled: true,
    });
    expect(result.tagCount).toBeLessThanOrEqual(24);
  });

  it("handles a single sentence with no trailing whitespace", () => {
    const result = buildPauseMarkup({
      text: "ما عاد في إشي بفرحني.",
      pauseScale: 1.7,
      enabled: true,
    });
    expect(result.tagCount).toBe(0);
    expect(result.text).toBe("ما عاد في إشي بفرحني.");
  });
});

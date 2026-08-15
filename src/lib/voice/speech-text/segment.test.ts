import { describe, expect, it } from "vitest";
import { pauseForBoundary, prepareSpeech, segmentSpeech } from "@/lib/voice/speech-text";
import { ARABIC_CORPUS, ENGLISH_CORPUS } from "@/lib/voice/speech-text/corpus";

describe("Arabic segmentation", () => {
  it("splits a long multi-clause turn into conversational segments", () => {
    const long =
      "يعني بصراحة, من فترة وأنا بحس إني مش مرتاح, ولما أطلع من البيت بصير الخوف أسوأ وما بعرف شو أعمل بهالحالة.";
    const segments = segmentSpeech(long, "ar");
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.map((s) => s.text).join(" ")).toContain("ولما أطلع");
  });

  it("does not split every comma", () => {
    const short = "بصراحة, تعبت, بس ماشي الحال.";
    expect(segmentSpeech(short, "ar")).toHaveLength(1);
  });

  it("splits on sentence terminals", () => {
    const two = "ما بعرف شو بدي أحكي. صرت أتجنب الناس.";
    const segments = segmentSpeech(two, "ar");
    expect(segments).toHaveLength(2);
    expect(segments[0]!.boundary).toBe("sentence");
  });

  it("keeps ellipsis inside a segment instead of treating it as a terminal", () => {
    const segments = segmentSpeech("يعني... ما بعرف كيف أشرحها.", "ar");
    expect(segments).toHaveLength(1);
    expect(segments[0]!.text).toContain("...");
  });

  it("never emits a bare filler as its own segment", () => {
    const segments = segmentSpeech("يعني. ما بعرف كيف أشرحها لحضرتك.", "ar");
    for (const segment of segments) {
      expect(segment.text.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("marks question boundaries distinctly", () => {
    const segments = segmentSpeech("ليش صار هيك? ما في سبب واضح أبداً.", "ar");
    expect(segments[0]!.boundary).toBe("question");
  });
});

describe("English segmentation", () => {
  it("splits on sentence terminals", () => {
    const segments = segmentSpeech(
      "I don't know. It started six months ago, I think.",
      "en",
    );
    expect(segments).toHaveLength(2);
  });

  it("leaves a single short sentence alone", () => {
    expect(
      segmentSpeech("Do you think that's normal?", "en"),
    ).toHaveLength(1);
  });

  it("splits an over-long sentence at clause boundaries", () => {
    const long =
      "Some days I feel completely fine and then it just drops without any warning, and I end up staying in bed for the rest of the afternoon.";
    const segments = segmentSpeech(long, "en");
    expect(segments.length).toBeGreaterThan(1);
  });
});

describe("pause budget", () => {
  it("orders pauses by boundary strength", () => {
    expect(pauseForBoundary("question")).toBeGreaterThan(
      pauseForBoundary("sentence"),
    );
    expect(pauseForBoundary("sentence")).toBeGreaterThan(
      pauseForBoundary("clause"),
    );
    expect(pauseForBoundary("clause")).toBeGreaterThan(
      pauseForBoundary("length"),
    );
    expect(pauseForBoundary("final")).toBe(0);
  });

  it("scales and clamps within bounds", () => {
    expect(pauseForBoundary("sentence", 0)).toBe(0);
    expect(pauseForBoundary("sentence", 10)).toBeLessThanOrEqual(600);
    expect(pauseForBoundary("sentence", 0.5)).toBeLessThan(
      pauseForBoundary("sentence", 1),
    );
  });

  it("always ends a turn with a zero pause", () => {
    for (const entry of [...ARABIC_CORPUS, ...ENGLISH_CORPUS]) {
      const { segments } = prepareSpeech(entry.text, entry.locale);
      if (!segments.length) continue;
      expect(segments[segments.length - 1]!.pauseAfterMs, entry.id).toBe(0);
      expect(segments[segments.length - 1]!.boundary, entry.id).toBe("final");
    }
  });

  it("keeps every pause inside the non-theatrical band", () => {
    for (const entry of ARABIC_CORPUS) {
      for (const segment of prepareSpeech(entry.text, "ar").segments) {
        expect(segment.pauseAfterMs, entry.id).toBeGreaterThanOrEqual(0);
        expect(segment.pauseAfterMs, entry.id).toBeLessThanOrEqual(600);
      }
    }
  });
});

describe("segmentation invariants", () => {
  it("preserves all spoken content across segments", () => {
    for (const entry of [...ARABIC_CORPUS, ...ENGLISH_CORPUS]) {
      const prepared = prepareSpeech(entry.text, entry.locale);
      const rejoined = prepared.segments
        .map((s) => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const expected = prepared.speechText.replace(/\s+/g, " ").trim();
      expect(rejoined, entry.id).toBe(expected);
    }
  });

  it("respects the segment cap", () => {
    const many = Array.from({ length: 40 }, (_, i) => `Sentence ${i}.`).join(" ");
    expect(segmentSpeech(many, "en", { maxSegments: 5 }).length).toBeLessThanOrEqual(5);
  });

  it("returns no segments for empty input", () => {
    expect(segmentSpeech("   ", "ar")).toEqual([]);
    expect(prepareSpeech("", "en").segments).toEqual([]);
  });
});

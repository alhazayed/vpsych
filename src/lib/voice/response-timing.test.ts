import { describe, expect, it } from "vitest";
import {
  effectivePauseBeforeMs,
  MAX_PAUSE_BEFORE_MS,
  stitchingContextForChunk,
} from "@/lib/voice/response-timing";

describe("effectivePauseBeforeMs — natural, not slow", () => {
  it("legacy (no anchor) keeps the full clamped pause", () => {
    expect(effectivePauseBeforeMs({ pauseBeforeMs: 900, now: 5000 })).toBe(900);
    expect(effectivePauseBeforeMs({ pauseBeforeMs: 99_999, now: 0 })).toBe(
      MAX_PAUSE_BEFORE_MS,
    );
  });

  it("processing time since end-of-speech counts toward the pause", () => {
    // Therapist stopped at t=1000; reply ready at t=1600 → 300 ms left.
    expect(
      effectivePauseBeforeMs({ pauseBeforeMs: 900, anchorAt: 1000, now: 1600 }),
    ).toBe(300);
  });

  it("never adds delay once the pipeline already exceeded the pause", () => {
    expect(
      effectivePauseBeforeMs({ pauseBeforeMs: 900, anchorAt: 1000, now: 4200 }),
    ).toBe(0);
  });

  it("zero / invalid pause stays zero", () => {
    expect(effectivePauseBeforeMs({ pauseBeforeMs: null, now: 0 })).toBe(0);
    expect(
      effectivePauseBeforeMs({ pauseBeforeMs: Number.NaN, anchorAt: 0, now: 0 }),
    ).toBe(0);
  });
});

describe("stitchingContextForChunk", () => {
  const chunks = ["آه، فهمت.", "بس أنا ما بعرف إذا هاد طبيعي.", "صرلي أسبوعين هيك."];

  it("single-chunk replies need no stitching", () => {
    expect(stitchingContextForChunk(["Okay."], 0)).toEqual({});
  });

  it("first chunk gets only next text; later chunks get prior context", () => {
    expect(stitchingContextForChunk(chunks, 0)).toEqual({ nextText: chunks[1] });
    expect(stitchingContextForChunk(chunks, 1)).toEqual({
      previousText: chunks[0],
      nextText: chunks[2],
    });
    expect(stitchingContextForChunk(chunks, 2)).toEqual({
      previousText: `${chunks[0]} ${chunks[1]}`,
    });
  });

  it("bounds context at a word boundary", () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(" ");
    const ctx = stitchingContextForChunk([long, "end."], 1, 50);
    expect(ctx.previousText!.length).toBeLessThanOrEqual(50);
    expect(long.endsWith(ctx.previousText!)).toBe(true);
    expect(ctx.previousText!.startsWith("word")).toBe(true);
  });
});

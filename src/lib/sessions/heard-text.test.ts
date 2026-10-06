import { describe, expect, it, vi } from "vitest";
import {
  applyHeardText,
  heardCharsFromFraction,
  loadAssessmentMessages,
  playbackFraction,
  withHeardText,
} from "./heard-text";

describe("playbackFraction", () => {
  it("uses audio position for ElevenLabs playback", () => {
    expect(
      playbackFraction("hello", { kind: "audio", currentTime: 2, duration: 8 }),
    ).toBeCloseTo(0.25);
  });

  it("returns 0 when audio duration is unknown", () => {
    expect(
      playbackFraction("hello", { kind: "audio", currentTime: 2, duration: NaN }),
    ).toBe(0);
  });

  it("estimates browser speech from elapsed time and caps at 1", () => {
    const text = "x".repeat(140); // ~10 s at 14 chars/s
    expect(playbackFraction(text, { kind: "elapsed", elapsedMs: 5000 })).toBeCloseTo(0.5);
    expect(playbackFraction(text, { kind: "elapsed", elapsedMs: 60000 })).toBe(1);
  });

  it("is 0 before audio started", () => {
    expect(playbackFraction("hello", { kind: "not_started" })).toBe(0);
  });
});

describe("heardCharsFromFraction", () => {
  const text = "I just feel tired all the time";

  it("snaps forward to the end of the word in progress", () => {
    // 0.2 * 30 = 6 → inside "just" → end of "just" (6)
    expect(heardCharsFromFraction(text, 0.2)).toBe(6);
    // 0.25 * 30 ≈ 8 → inside "feel" → 11
    expect(heardCharsFromFraction(text, 0.25)).toBe(11);
  });

  it("handles start and end", () => {
    expect(heardCharsFromFraction(text, 0)).toBe(0);
    expect(heardCharsFromFraction(text, 1)).toBe(text.length);
  });

  it("works for Arabic text", () => {
    const ar = "أنا تعبانة كثير هالفترة";
    const cut = heardCharsFromFraction(ar, 0.3);
    expect(ar.slice(0, cut)).toBe("أنا تعبانة");
  });
});

describe("applyHeardText", () => {
  it("leaves uninterrupted replies unchanged", () => {
    expect(applyHeardText("All of it.", null, "en")).toBe("All of it.");
    expect(applyHeardText("All of it.", 99, "en")).toBe("All of it.");
  });

  it("cuts at the heard offset and marks the interruption", () => {
    expect(applyHeardText("I just feel tired all the time", 11, "en")).toBe(
      "I just feel … [the therapist interrupted here; the rest was not heard]",
    );
  });

  it("marks a reply interrupted before any word", () => {
    expect(applyHeardText("Hello", 0, "ar")).toBe(
      "[قاطع المعالج المريض هنا؛ لم يُسمع باقي الكلام]",
    );
  });
});

describe("withHeardText", () => {
  it("only changes interrupted assistant rows", () => {
    const rows = [
      { role: "user" as const, content: "How are you?", heard_chars: null },
      { role: "assistant" as const, content: "Not good at all today", heard_chars: 8 },
      { role: "assistant" as const, content: "Fine.", heard_chars: null },
    ];
    const out = withHeardText(rows, "en");
    expect(out[0]).toBe(rows[0]);
    expect(out[1]?.content.startsWith("Not good …")).toBe(true);
    expect(out[1]?.content).not.toContain("today");
    expect(out[2]).toBe(rows[2]);
    // Stored rows are not mutated.
    expect(rows[1]?.content).toBe("Not good at all today");
  });
});

describe("loadAssessmentMessages", () => {
  function client(results: Array<{ data: unknown; error: unknown }>) {
    const selects: string[] = [];
    const from = vi.fn(() => ({
      select: (cols: string) => {
        selects.push(cols);
        const result = results.shift();
        return { eq: () => ({ order: async () => result }) };
      },
    }));
    return { client: { from } as never, selects };
  }

  it("reads heard_chars when the column exists", async () => {
    const rows = [{ role: "assistant", content: "x", created_at: "t", heard_chars: 0 }];
    const { client: c, selects } = client([{ data: rows, error: null }]);
    const out = await loadAssessmentMessages(c, "s1");
    expect(out).toEqual({ data: rows, error: null });
    expect(selects).toEqual(["role, content, created_at, heard_chars"]);
  });

  it("falls back to the old columns when heard_chars is not deployed", async () => {
    const rows = [{ role: "user", content: "hi", created_at: "t" }];
    const { client: c, selects } = client([
      { data: null, error: { message: "column session_messages.heard_chars does not exist" } },
      { data: rows, error: null },
    ]);
    const out = await loadAssessmentMessages(c, "s1");
    expect(out).toEqual({ data: rows, error: null });
    expect(selects[1]).toBe("role, content, created_at");
  });
});

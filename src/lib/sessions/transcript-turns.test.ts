import { describe, expect, it } from "vitest";
import { numberTranscriptTurns, turnAnchorId } from "./transcript-turns";

describe("numberTranscriptTurns", () => {
  it("numbers like the examiner: the opening system line counts, then is hidden", () => {
    const turns = numberTranscriptTurns([
      { role: "system", content: "Session started." },
      { role: "user", content: "Hello, I'm Sam." },
      { role: "assistant", content: "Hi." },
      { role: "user", content: "What brings you here?" },
    ]);
    expect(turns.map((t) => [t.turn, t.content])).toEqual([
      [2, "Hello, I'm Sam."],
      [3, "Hi."],
      [4, "What brings you here?"],
    ]);
  });

  it("keeps numbering stable around a system line in the middle", () => {
    const turns = numberTranscriptTurns([
      { role: "user", content: "a" },
      { role: "system", content: "note" },
      { role: "assistant", content: "b" },
    ]);
    expect(turns.map((t) => t.turn)).toEqual([1, 3]);
  });

  it("returns nothing for an empty session", () => {
    expect(numberTranscriptTurns([])).toEqual([]);
  });
});

describe("turnAnchorId", () => {
  it("is plain without a scope", () => {
    expect(turnAnchorId(7)).toBe("turn-7");
  });

  it("prefixes a short, id-safe scope", () => {
    expect(turnAnchorId(3, "6db0564d-76a0-470b-af42-93e359451ea5")).toBe("6db0564d-76a-turn-3");
    expect(turnAnchorId(3, "a b#c")).toBe("abc-turn-3");
  });
});

describe("examiner numbering", () => {
  it("still numbers every loaded message from 1, system lines included", async () => {
    // If the examiner ever skips system lines or renumbers, evidence links
    // would point at the wrong line: change numberTranscriptTurns with it.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/ai/assessment.ts", "utf8");
    expect(src).toMatch(/const turns: EvidenceTurn\[\] = messages\.map\(\(m, i\) => \(\{\s*n: i \+ 1,/);
    const ends = readFileSync("src/lib/sessions/heard-text.ts", "utf8");
    // The end route loads every role in created_at order for the examiner.
    const loader = ends.slice(ends.indexOf("export async function loadAssessmentMessages"));
    expect(loader.slice(0, 900)).not.toMatch(/\.in\("role"/);
    expect(loader.slice(0, 900)).toMatch(/\.order\("created_at", \{ ascending: true \}\)/);
  });
});

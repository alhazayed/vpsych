import { describe, expect, it } from "vitest";
import {
  chunkTextForSpeechPlayback,
  coalesceSpeechChunksToBudget,
  DEFAULT_MAX_SPEECH_CHUNK_CHARS,
  joinSpeechChunks,
  MAX_COALESCED_SPEECH_CHUNK_CHARS,
  MAX_PROGRESSIVE_TTS_CHUNKS,
  planSpeechChunksForPlayback,
} from "@/lib/voice/speech-chunker";

describe("chunkTextForSpeechPlayback", () => {
  it("A — English sentence chunking", () => {
    const chunks = chunkTextForSpeechPlayback(
      "Sentence one. Sentence two. Sentence three.",
    );
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toMatch(/Sentence one\./);
    expect(joinSpeechChunks(chunks)).toBe(
      "Sentence one. Sentence two. Sentence three.",
    );
  });

  it("B — Arabic sentence chunking with ؟ and 。", () => {
    const text = "كيف حالك اليوم؟ أنا متعب قليلاً. لكنني بخير…";
    const chunks = chunkTextForSpeechPlayback(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((c) => c.includes("؟"))).toBe(true);
    expect(joinSpeechChunks(chunks)).toBe(
      text.replace(/\s+/g, " ").trim(),
    );
  });

  it("C — punctuation handling keeps terminators with phrases", () => {
    const chunks = chunkTextForSpeechPlayback("Wait… Really? Yes!");
    expect(chunks.join(" ")).toContain("…");
    expect(chunks.join(" ")).toContain("?");
    expect(chunks.join(" ")).toContain("!");
  });

  it("C — Arabic comma ، and semicolon ؛ soft-split long lines", () => {
    const long =
      "كنت أشعر بالقلق، ثم حاولت أن أتنفس، وبعد ذلك شعرت بشيء من الهدوء؛ لكن الفكرة عادت مرة أخرى.";
    const chunks = chunkTextForSpeechPlayback(long, { maxChars: 60 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 60)).toBe(true);
  });

  it("C2 — Arabic semicolon U+061B is a soft clause boundary", () => {
    // Specific ؛ (U+061B) — must soft-split, not fall through to hard word split.
    const left = "شعرت بشيء من الهدوء";
    const right = "لكن الفكرة عادت مرة أخرى مع المزيد من التفاصيل";
    const text = `${left}؛ ${right}`;
    const chunks = chunkTextForSpeechPlayback(text, { maxChars: 40 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain("؛");
    expect(chunks[0]).toMatch(/هدوء؛$/);
    // Clinical text preserved (whitespace-normalized).
    expect(joinSpeechChunks(chunks)).toBe(text);
    // Soft boundary: first chunk ends at ؛, not mid-word hard split.
    expect(chunks[0]!.endsWith("؛")).toBe(true);
  });

  it("D — bounded chunk size hard-caps oversized text", () => {
    const word = "abcdefghij";
    const text = Array.from({ length: 40 }, () => word).join(" ");
    const chunks = chunkTextForSpeechPlayback(text, { maxChars: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 50)).toBe(true);
  });

  it("does not rewrite clinical meaning (whitespace-normalized equality)", () => {
    const text =
      "I take sertraline 50mg. My sleep is worse lately! Does that make sense?";
    const chunks = chunkTextForSpeechPlayback(text);
    expect(joinSpeechChunks(chunks)).toBe(text);
  });

  it("single short utterance stays one chunk", () => {
    expect(chunkTextForSpeechPlayback("Mm.")).toEqual(["Mm."]);
  });

  it("uses default max bound", () => {
    expect(DEFAULT_MAX_SPEECH_CHUNK_CHARS).toBe(180);
  });

  it("is deterministic", () => {
    const text = "One. Two. Three. Four.";
    expect(chunkTextForSpeechPlayback(text)).toEqual(
      chunkTextForSpeechPlayback(text),
    );
  });
});

describe("planSpeechChunksForPlayback — Phase 9.2R chunk budget", () => {
  it("documents conservative progressive chunk budget", () => {
    expect(MAX_PROGRESSIVE_TTS_CHUNKS).toBe(6);
    expect(MAX_COALESCED_SPEECH_CHUNK_CHARS).toBe(480);
  });

  it("normal multi-sentence replies remain progressive", () => {
    const plan = planSpeechChunksForPlayback(
      "Sentence one. Sentence two. Sentence three.",
    );
    expect(plan.mode).toBe("progressive");
    if (plan.mode === "progressive") {
      expect(plan.chunks.length).toBeGreaterThanOrEqual(2);
      expect(plan.chunks.length).toBeLessThanOrEqual(MAX_PROGRESSIVE_TTS_CHUNKS);
      expect(joinSpeechChunks(plan.chunks)).toBe(
        "Sentence one. Sentence two. Sentence three.",
      );
    }
  });

  it("over-budget replies do not emit unbounded progressive chunks", () => {
    const sentences = Array.from(
      { length: 20 },
      (_, i) => `This is clinical sentence number ${i + 1} about sleep.`,
    );
    const text = sentences.join(" ");
    const raw = chunkTextForSpeechPlayback(text);
    expect(raw.length).toBeGreaterThan(MAX_PROGRESSIVE_TTS_CHUNKS);

    const plan = planSpeechChunksForPlayback(text);
    if (plan.mode === "progressive") {
      expect(plan.chunks.length).toBeLessThanOrEqual(MAX_PROGRESSIVE_TTS_CHUNKS);
      expect(joinSpeechChunks(plan.chunks)).toBe(joinSpeechChunks(raw));
    } else {
      expect(plan.reason).toBe("exceeds_chunk_budget");
      expect(plan.text).toBe(text.replace(/\s+/g, " ").trim());
    }
  });

  it("legacy budget fallback preserves clinical text and is not a rewrite", () => {
    // Force legacy: tiny coalesce ceiling so safe merges cannot fit budget.
    const sentences = Array.from(
      { length: 12 },
      (_, i) =>
        `Longer clinical phrase ${i + 1} that will not merge under a tiny ceiling.`,
    );
    const text = sentences.join(" ");
    const plan = planSpeechChunksForPlayback(text, {
      maxChunks: 2,
      maxCoalescedChars: 50,
      maxChars: 80,
    });
    expect(plan.mode).toBe("legacy_blob");
    if (plan.mode === "legacy_blob") {
      expect(plan.text).toBe(text.replace(/\s+/g, " ").trim());
      expect(plan.reason).toBe("exceeds_chunk_budget");
    }
  });

  it("coalesce preserves prefix chunk when merging the tail", () => {
    const chunks = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H."];
    const coalesced = coalesceSpeechChunksToBudget(chunks, 6, 480);
    expect(coalesced).not.toBeNull();
    expect(coalesced!.length).toBeLessThanOrEqual(6);
    expect(coalesced![0]).toBe("A.");
    expect(joinSpeechChunks(coalesced!)).toBe(joinSpeechChunks(chunks));
  });

  it("coalesce returns null when merges cannot fit the budget safely", () => {
    const chunks = [
      "aaaaaaaaaaaaaaaaaaaa",
      "bbbbbbbbbbbbbbbbbbbb",
      "cccccccccccccccccccc",
      "dddddddddddddddddddd",
    ];
    expect(coalesceSpeechChunksToBudget(chunks, 2, 25)).toBeNull();
  });
});

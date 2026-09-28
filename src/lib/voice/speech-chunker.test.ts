import { describe, expect, it } from "vitest";
import {
  chunkTextForSpeechPlayback,
  DEFAULT_MAX_SPEECH_CHUNK_CHARS,
  joinSpeechChunks,
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

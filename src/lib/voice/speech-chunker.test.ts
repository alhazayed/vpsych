import { describe, expect, it } from "vitest";
import {
  chunkTextForSpeechPlayback,
  coalesceSpeechChunksToBudget,
  DEFAULT_MAX_SPEECH_CHUNK_CHARS,
  joinSpeechChunks,
  splitLongFirstChunk,
  FIRST_CHUNK_SOFT_MAX_CHARS,
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

describe("Human Conversation Fidelity — natural hard-split boundaries", () => {
  const AR_FUNCTION_WORDS = new Set(["أن", "في", "على", "عن", "من", "مع", "و"]);
  const EN_FUNCTION_WORDS = new Set(["the", "a", "to", "of", "in", "with"]);

  it("long unpunctuated Arabic never ends a chunk on a binding particle", () => {
    const text =
      "أنا أعتقد أن حالتك النفسية تحتاج إلى تقييم أوسع لأنه في أشياء كثير صارت معك من فترة ومش واضح إذا هي مرتبطة بالشغل أو بالبيت أو بالنوم اللي صار قليل كثير في الأسابيع الأخيرة";
    const chunks = chunkTextForSpeechPlayback(text, { maxChars: 60 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks.slice(0, -1)) {
      const last = chunk.split(/\s+/).pop()!;
      expect(AR_FUNCTION_WORDS.has(last)).toBe(false);
    }
    expect(joinSpeechChunks(chunks)).toBe(text);
  });

  it("prefers breaking before a connective (لأنه / and / because)", () => {
    const text =
      "I have been trying to sleep earlier every night for the last few weeks because my doctor told me that it would help with the anxiety I feel in the mornings";
    const chunks = chunkTextForSpeechPlayback(text, { maxChars: 100 });
    expect(chunks[1]!.startsWith("because")).toBe(true);
    for (const chunk of chunks.slice(0, -1)) {
      expect(EN_FUNCTION_WORDS.has(chunk.split(/\s+/).pop()!.toLowerCase())).toBe(
        false,
      );
    }
    expect(joinSpeechChunks(chunks)).toBe(text);
  });

  it("short acknowledgements stay one short chunk (short responses sound short)", () => {
    expect(chunkTextForSpeechPlayback("آه، فهمت.")).toEqual(["آه، فهمت."]);
    expect(chunkTextForSpeechPlayback("تمام.")).toEqual(["تمام."]);
  });
});

describe("Human Conversation Fidelity — short first chunk for faster first audio", () => {
  it("splits a long first sentence at its first clause boundary (Arabic)", () => {
    const reply =
      "والله يا دكتور صرلي فترة طويلة، ما بقدر أنام منيح وبصحى بالليل كذا مرة وأنا متضايق. بس اليوم أحسن شوي.";
    const plan = planSpeechChunksForPlayback(reply);
    expect(plan.mode).toBe("progressive");
    if (plan.mode !== "progressive") return;
    expect(plan.chunks[0]).toBe("والله يا دكتور صرلي فترة طويلة،");
    expect(plan.chunks[0]!.length).toBeLessThanOrEqual(FIRST_CHUNK_SOFT_MAX_CHARS);
    expect(joinSpeechChunks(plan.chunks)).toBe(reply);
  });

  it("falls back to a connective when the first sentence has no comma (English)", () => {
    const reply =
      "I have not been sleeping well at all lately because work keeps me up thinking about everything I did wrong.";
    const plan = planSpeechChunksForPlayback(reply);
    if (plan.mode !== "progressive") throw new Error("expected progressive");
    expect(plan.chunks[0]).toBe("I have not been sleeping well at all lately");
    expect(plan.chunks[1]!.startsWith("because")).toBe(true);
    expect(joinSpeechChunks(plan.chunks)).toBe(reply);
  });

  it("leaves short first sentences and short replies alone", () => {
    for (const short of [
      "آه، فهمت. يعني النوم صار صعب من فترة؟",
      "I see, that sounds hard. Tell me more about it.",
    ]) {
      const plan = planSpeechChunksForPlayback(short);
      if (plan.mode !== "progressive") throw new Error("expected progressive");
      // Under the first-chunk limit: identical to the plain chunker output.
      expect(plan.chunks).toEqual(chunkTextForSpeechPlayback(short));
    }
  });

  it("never clips a micro tail into its own chunk", () => {
    const chunks = splitLongFirstChunk([
      "I have been thinking about what you said last week about my mother, okay.",
    ]);
    expect(chunks).toHaveLength(1);
  });

  it("can be disabled", () => {
    const reply =
      "I have not been sleeping well at all lately because work keeps me up thinking about everything I did wrong.";
    const plan = planSpeechChunksForPlayback(reply, { firstChunkSoftMaxChars: 0 });
    if (plan.mode !== "progressive") throw new Error("expected progressive");
    expect(plan.chunks).toEqual([reply]);
  });
});

import { describe, expect, it } from "vitest";
import {
  createStreamedReplySpeech,
  endOfLeadingSentence,
} from "@/lib/voice/streamed-reply";

const FINAL = "A few months, I guess. I lie there and my head just won't stop.";

describe("createStreamedReplySpeech", () => {
  it("speaks the first released sentence, then the rest of the saved reply", async () => {
    const s = createStreamedReplySpeech();
    const first = s.source.next();
    s.sentence({ text: "A few months, I guess.", attempt: 1 });
    expect(await first).toMatchObject({ text: "A few months, I guess.", offset: 0 });
    const rest = s.source.next();
    s.sentence({ text: "I lie there and my head just won't stop.", attempt: 1 });
    s.finish(FINAL);
    const second = await rest;
    expect(second).toMatchObject({ text: "I lie there and my head just won't stop." });
    // Offset points into the saved reply, for the heard-portion record.
    expect(FINAL.slice(second!.offset)).toBe(second!.text);
    expect(await s.source.next()).toBeNull();
  });

  it("waits for the clinical thinking pause before the first part", async () => {
    let release!: () => void;
    const notBefore = new Promise<void>((r) => (release = r));
    const s = createStreamedReplySpeech({ notBefore });
    let got = false;
    const first = s.source.next().then((v) => ((got = true), v));
    s.sentence({ text: "Hmm.", attempt: 1 });
    await Promise.resolve();
    await Promise.resolve();
    expect(got).toBe(false);
    release();
    expect(await first).toMatchObject({ text: "Hmm." });
  });

  it("speaks the saved reply whole when nothing was released early", async () => {
    const s = createStreamedReplySpeech();
    const first = s.source.next();
    s.finish(FINAL);
    expect(await first).toEqual({ text: FINAL, offset: 0 });
    expect(await s.source.next()).toBeNull();
  });

  it("cuts a sentence whose draft was discarded and speaks the new saved reply whole", async () => {
    const s = createStreamedReplySpeech();
    const first = s.source.next();
    s.sentence({ text: "Yeah.", attempt: 1 });
    const part = await first;
    expect(part!.cut!.aborted).toBe(false);
    const rest = s.source.next();
    s.regenerating(2);
    expect(part!.cut!.aborted).toBe(true);
    // A sentence from the discarded draft arriving late is ignored.
    s.sentence({ text: "Late old sentence.", attempt: 1 });
    s.finish("No, not really. It's been hard.");
    expect(await rest).toEqual({ text: "No, not really. It's been hard.", offset: 0 });
  });

  it("speaks nothing more when the turn failed", async () => {
    const s = createStreamedReplySpeech();
    const first = s.source.next();
    s.sentence({ text: "A few months, I guess.", attempt: 1 });
    await first;
    const rest = s.source.next();
    s.finish(null);
    expect(await rest).toBeNull();
  });

  it("returns nothing when the turn fails before any sentence", async () => {
    const s = createStreamedReplySpeech();
    const first = s.source.next();
    s.finish(null);
    expect(await first).toBeNull();
  });

  it("speaks the saved reply whole if it does not open with the spoken sentence", async () => {
    const s = createStreamedReplySpeech();
    const first = s.source.next();
    s.sentence({ text: "Something else.", attempt: 1 });
    await first;
    const rest = s.source.next();
    s.finish(FINAL);
    expect(await rest).toEqual({ text: FINAL, offset: 0 });
  });

  it("handles Arabic replies", async () => {
    const ar = "مش عارفة… يمكن من شهرين. ما بقدر أنام منيح.";
    const s = createStreamedReplySpeech();
    const first = s.source.next();
    s.sentence({ text: "مش عارفة… يمكن من شهرين.", attempt: 1 });
    await first;
    const rest = s.source.next();
    s.finish(ar);
    expect(await rest).toMatchObject({ text: "ما بقدر أنام منيح." });
  });
});

describe("endOfLeadingSentence", () => {
  it("finds the end of the opening sentence, ignoring leading space", () => {
    expect(endOfLeadingSentence("  Hi there. More.", "Hi there.")).toBe(11);
    expect(endOfLeadingSentence("Other. Hi there.", "Hi there.")).toBe(-1);
    expect(endOfLeadingSentence("Hi", "")).toBe(-1);
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  isContentlessPatientReply,
  validatePatientReply,
} from "@/lib/ai/reply-validation";

describe("reply-validation D4 contentless gate", () => {
  const INVALID = ["", " ", "…", "……", "يعني… …", "...", "!!!", "؟؟", "   …   "];

  const VALID = ["آه.", "لا.", "مش كثير.", "يمكن.", "ممكن.", "Mm.", "Okay."];

  it.each(INVALID)("rejects invalid contentless %j", (text) => {
    expect(isContentlessPatientReply(text)).toBe(true);
    expect(validatePatientReply(text).ok).toBe(false);
  });

  it.each(VALID)("accepts legitimate short answer %j", (text) => {
    expect(isContentlessPatientReply(text)).toBe(false);
    expect(validatePatientReply(text).ok).toBe(true);
  });

  it("rejects punctuation-only output", () => {
    expect(validatePatientReply("...").ok).toBe(false);
    expect(validatePatientReply("—").ok).toBe(false);
    const dot = validatePatientReply(".");
    expect(dot.ok).toBe(false);
    if (!dot.ok) expect(dot.reason).toBe("punctuation_only");
  });

  it("mutation: adding a real word after ellipsis makes it valid", () => {
    expect(validatePatientReply("يعني… مش عارف.").ok).toBe(true);
    expect(isContentlessPatientReply("يعني… مش عارف.")).toBe(false);
  });
});

/**
 * Message-route regen contract (unit-level simulation).
 * At most ONE regeneration; invalid never reaches "persist" / "tts" sinks.
 */
describe("contentless regen contract (message route simulation)", () => {
  async function simulateMessageGate(opts: {
    first: string;
    second?: string;
    fallback?: string;
  }): Promise<{
    persisted: string;
    tts: string;
    generateCalls: number;
    persistedInvalid: boolean;
  }> {
    let generateCalls = 0;
    const generate = async () => {
      generateCalls += 1;
      if (generateCalls === 1) return opts.first;
      return opts.second ?? opts.first;
    };

    let text = await generate();
    if (!validatePatientReply(text).ok) {
      text = await generate();
      if (!validatePatientReply(text).ok) {
        text = opts.fallback ?? "آه.";
      }
    }
    // Persist + TTS only after validation / fallback.
    const finalOk = validatePatientReply(text).ok;
    expect(finalOk).toBe(true);
    return {
      persisted: text,
      tts: text,
      generateCalls,
      persistedInvalid: !finalOk,
    };
  }

  it("single regeneration only — second still invalid → fallback", async () => {
    const result = await simulateMessageGate({
      first: "…",
      second: "يعني… …",
      fallback: "آه.",
    });
    expect(result.generateCalls).toBe(2);
    expect(result.persisted).toBe("آه.");
    expect(result.tts).toBe("آه.");
    expect(result.persistedInvalid).toBe(false);
  });

  it("no infinite retry — exactly one regen then stop", async () => {
    const spy = vi.fn();
    let calls = 0;
    const generate = async () => {
      calls += 1;
      spy();
      return "…";
    };
    let text = await generate();
    if (!validatePatientReply(text).ok) {
      text = await generate();
      if (!validatePatientReply(text).ok) {
        text = "لا.";
      }
    }
    // Would-be third call never happens.
    expect(calls).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(validatePatientReply(text).ok).toBe(true);
  });

  it("no persistence of invalid output", async () => {
    const sink: string[] = [];
    let text = "……";
    if (!validatePatientReply(text).ok) {
      text = "يمكن.";
    }
    if (validatePatientReply(text).ok) sink.push(text);
    expect(sink).toEqual(["يمكن."]);
    expect(sink).not.toContain("……");
  });

  it("no TTS for invalid output", async () => {
    const ttsQueue: string[] = [];
    let text = "";
    if (!validatePatientReply(text).ok) {
      text = "مش كثير.";
    }
    if (validatePatientReply(text).ok) ttsQueue.push(text);
    expect(ttsQueue).toEqual(["مش كثير."]);
  });

  it("final valid response is persisted normally after one regen", async () => {
    const result = await simulateMessageGate({
      first: " ",
      second: "ممكن.",
    });
    expect(result.generateCalls).toBe(2);
    expect(result.persisted).toBe("ممكن.");
  });
});

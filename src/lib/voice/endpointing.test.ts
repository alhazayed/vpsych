import { describe, expect, it } from "vitest";
import {
  classifyUtteranceCompleteness,
  decideEndpoint,
  ENDPOINT_TIMING,
  requiredEndpointSilenceMs,
} from "@/lib/voice/endpointing";

describe("classifyUtteranceCompleteness — Arabic (MSA + Jordanian)", () => {
  it.each([
    ["أنا من فترة…", "incomplete"],
    ["أنا من فترة...", "incomplete"],
    ["بصراحة ما بعرف، لأنه", "incomplete"],
    ["كنت بدي أحكيلك إنه", "incomplete"],
    ["أنا أخذت الدوا بس", "incomplete"],
    ["المشكلة إنو كل ما أحاول أنام و", "incomplete"],
    ["حاسس حالي تعبان امم", "incomplete"],
    ["أنا من فترة ما بنام منيح.", "complete"],
    ["كيف كان نومك هالأسبوع؟", "complete"],
    ["طيب", "complete"],
    ["تمام.", "complete"],
    ["لا", "complete"],
    ["أنا من فترة", "uncertain"],
  ])("%s → %s", (text, expected) => {
    expect(classifyUtteranceCompleteness(text)).toBe(expected);
  });

  it("ignores tashkeel and tatweel when matching trailing particles", () => {
    expect(classifyUtteranceCompleteness("ما قدرت أنام لأنَّهُ")).toBe(
      "incomplete",
    );
    expect(classifyUtteranceCompleteness("رحت عند الدكتور والـ")).toBe(
      "incomplete",
    );
  });
});

describe("classifyUtteranceCompleteness — English and code-switching", () => {
  it.each([
    ["I've been feeling really tired and", "incomplete"],
    ["I stopped taking it because", "incomplete"],
    ["So what I wanted to say was, um", "incomplete"],
    ["I want to talk about the", "incomplete"],
    ["I haven't slept properly in weeks.", "complete"],
    ["How did that make you feel?", "complete"],
    ["Okay", "complete"],
    ["Yeah.", "complete"],
    ["I've been", "uncertain"],
  ])("%s → %s", (text, expected) => {
    expect(classifyUtteranceCompleteness(text)).toBe(expected);
  });

  it("treats a finished mixed Arabic/English sentence as complete", () => {
    expect(
      classifyUtteranceCompleteness(
        "أنا أخذت الـmedication مبارح بس ما قدرت أنام."),
    ).toBe("complete");
  });

  it("treats a mixed sentence ending on a connective as incomplete", () => {
    expect(
      classifyUtteranceCompleteness("أنا أخذت الـmedication مبارح بس"),
    ).toBe("incomplete");
  });

  it("empty transcript is uncertain (never a reason to commit early)", () => {
    expect(classifyUtteranceCompleteness("   ")).toBe("uncertain");
  });
});

describe("required endpoint silence", () => {
  it("complete thoughts commit at the pre-existing 850 ms budget", () => {
    expect(
      requiredEndpointSilenceMs({ completeness: "complete", speechMs: 3000 }),
    ).toBe(850);
  });

  it("unfinished thoughts get more room but stay bounded", () => {
    const incomplete = requiredEndpointSilenceMs({
      completeness: "incomplete",
      speechMs: 3000,
    });
    const uncertain = requiredEndpointSilenceMs({
      completeness: "uncertain",
      speechMs: 3000,
    });
    expect(incomplete).toBeGreaterThan(uncertain);
    expect(uncertain).toBeGreaterThan(850);
    expect(incomplete).toBeLessThanOrEqual(ENDPOINT_TIMING.maxSilenceMs);
  });

  it("very short speech is at least 'uncertain' unless clearly complete", () => {
    expect(
      requiredEndpointSilenceMs({ completeness: "uncertain", speechMs: 400 }),
    ).toBe(ENDPOINT_TIMING.uncertainSilenceMs);
    expect(
      requiredEndpointSilenceMs({ completeness: "complete", speechMs: 400 }),
    ).toBe(ENDPOINT_TIMING.completeSilenceMs);
  });

  it("never exceeds maxSilenceMs even with custom timing", () => {
    expect(
      requiredEndpointSilenceMs({
        completeness: "incomplete",
        speechMs: 100,
        timing: { incompleteSilenceMs: 99_999 },
      }),
    ).toBe(ENDPOINT_TIMING.maxSilenceMs);
  });

  it("decideEndpoint waits with remaining time, then commits", () => {
    const wait = decideEndpoint({
      completeness: "incomplete",
      speechMs: 2000,
      silenceMs: 1200,
    });
    expect(wait.action).toBe("wait");
    if (wait.action === "wait") expect(wait.remainingMs).toBe(800);
    expect(
      decideEndpoint({ completeness: "incomplete", speechMs: 2000, silenceMs: 2000 })
        .action,
    ).toBe("commit");
  });
});

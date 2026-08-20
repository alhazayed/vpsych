import { describe, expect, it } from "vitest";
import { normalizeArabicSpeech } from "@/lib/voice/speech-text/ar/normalize";
import { normalizeEnglishSpeech } from "@/lib/voice/speech-text/en/normalize";
import { prepareSpeech } from "@/lib/voice/speech-text";

/**
 * Clinical-semantic integrity of the speech layer.
 *
 * Regression cover for a reproduced defect: asterisk spans were deleted whole,
 * so any clinical content the model happened to wrap in asterisks vanished from
 * the spoken turn while remaining in the persisted transcript. Negation and
 * symptom reports were the realistic casualties.
 *
 * The invariant these tests pin: speech normalization may change how text is
 * VOICED, but may never delete, add, or negate clinical content.
 */

describe("asterisk markers must never delete clinical content — Arabic", () => {
  it("preserves negation (reproduced defect: 'I am NOT happy' became 'I am happy')", () => {
    const { text } = normalizeArabicSpeech("أنا *مش* مبسوط.");
    expect(text).toContain("مش");
    expect(text).toContain("مبسوط");
    expect(text).not.toContain("*");
    expect(text).toBe("أنا مش مبسوط.");
  });

  it("preserves a symptom report (reproduced defect: tightness was dropped)", () => {
    const { text } = normalizeArabicSpeech("بحس *بضيق* في صدري.");
    expect(text).toContain("بضيق");
    expect(text).not.toContain("*");
    expect(text).toBe("بحس بضيق في صدري.");
  });

  it("strips markers from stage-direction-style input without deleting words", () => {
    const { text } = normalizeArabicSpeech("*يتنهد* أنا تعبان.");
    expect(text).not.toContain("*");
    expect(text).toContain("أنا تعبان");
    // The enclosed word survives. A leaked stage direction is one audible extra
    // word; deleting it risked deleting clinical content indistinguishably.
    expect(text).toBe("يتنهد أنا تعبان.");
  });

  it("preserves risk content wrapped in asterisks", () => {
    const { text } = normalizeArabicSpeech("أحياناً بفكر إني *ما* بدي أعيش.");
    expect(text).toContain("ما");
    expect(text).toContain("بدّي أعيش");
    expect(text).not.toContain("*");
  });

  it("preserves a medication name and dose wrapped in asterisks", () => {
    const { text } = normalizeArabicSpeech("باخذ *سيرترالين* 50 مغ.");
    expect(text).toContain("سيرترالين");
    expect(text).toContain("خمسين");
    expect(text).toContain("ميليغرام");
    expect(text).not.toContain("*");
  });

  it("handles unbalanced and repeated markers without losing words", () => {
    expect(normalizeArabicSpeech("أنا *مش مبسوط.").text).toContain("مش");
    expect(normalizeArabicSpeech("أنا **مش** مبسوط.").text).toContain("مش");
    expect(normalizeArabicSpeech("أنا **مش** مبسوط.").text).not.toContain("*");
  });

  it("leaves asterisk-free clinical text byte-identical", () => {
    const src = "بتجيني نوبة هلع وبصير عندي خفقان.";
    const { text, changed } = normalizeArabicSpeech(src);
    expect(text).toBe(src);
    expect(changed).toBe(false);
  });
});

describe("asterisk markers must never delete clinical content — English", () => {
  it("preserves negation", () => {
    const { text } = normalizeEnglishSpeech("I am *not* okay.");
    expect(text).toContain("not");
    expect(text).toBe("I am not okay.");
    expect(text).not.toContain("*");
  });

  it("preserves a symptom report", () => {
    const { text } = normalizeEnglishSpeech("I feel *tightness* in my chest.");
    expect(text).toContain("tightness");
    expect(text).toBe("I feel tightness in my chest.");
  });

  it("preserves denial of suicidal ideation", () => {
    const { text } = normalizeEnglishSpeech(
      "No, I have *never* thought about hurting myself.",
    );
    expect(text).toContain("never");
    expect(text).not.toContain("*");
  });

  it("strips markers from stage-direction-style input without deleting words", () => {
    const { text } = normalizeEnglishSpeech("*sighs* I am tired.");
    expect(text).not.toContain("*");
    expect(text).toBe("sighs I am tired.");
  });

  it("leaves asterisk-free English byte-identical", () => {
    const src = "Nothing really makes me happy anymore.";
    const { text, changed } = normalizeEnglishSpeech(src);
    expect(text).toBe(src);
    expect(changed).toBe(false);
  });
});

describe("mixed-language clinical content", () => {
  it("preserves an English clinical term wrapped in asterisks inside Arabic", () => {
    const { text } = normalizeArabicSpeech("الدكتور حكى إنه عندي *PTSD*.");
    // Transliterated for pronunciation, but never dropped.
    expect(text).toContain("بي تي إس دي");
    expect(text).not.toContain("*");
  });

  it("preserves a negated English term inside Arabic", () => {
    const { text } = normalizeArabicSpeech("أنا *مش* عندي anxiety.");
    expect(text).toContain("مش");
    expect(text).toContain("anxiety");
  });
});

describe("end-to-end via prepareSpeech — display text is never mutated", () => {
  it("keeps negation through the full speech pipeline and leaves display intact", () => {
    const display = "أنا *مش* مبسوط. بحس *بضيق* في صدري.";
    const prepared = prepareSpeech(display, "ar");

    // Display text is untouched by the pure function.
    expect(display).toBe("أنا *مش* مبسوط. بحس *بضيق* في صدري.");
    // Both clinical items survive into speech.
    expect(prepared.speechText).toContain("مش");
    expect(prepared.speechText).toContain("بضيق");
    expect(prepared.speechText).not.toContain("*");
    // And into the segments actually handed to the provider.
    const joined = prepared.segments.map((s) => s.text).join(" ");
    expect(joined).toContain("مش");
    expect(joined).toContain("بضيق");
  });

  it("keeps English negation through the full pipeline", () => {
    const display = "I am *not* okay. I feel *tightness* in my chest.";
    const prepared = prepareSpeech(display, "en");
    expect(prepared.speechText).toContain("not");
    expect(prepared.speechText).toContain("tightness");
    expect(prepared.segments.map((s) => s.text).join(" ")).toContain("not");
  });
});

import { describe, expect, it } from "vitest";
import {
  countOccurrences,
  detectRepeatedPhrases,
  tracePhrase,
  traceRepeatedPhrases,
} from "@/lib/voice/qa/phrase-trace";
import { prepareSpeech } from "@/lib/voice/speech-text";

/**
 * Provenance of a repeated phrase.
 *
 * Human QA heard «فاهمني؟» over and over. These tests pin that the trace can
 * tell apart a model that repeated itself from a speech layer or segmenter that
 * duplicated something — because the remedy is completely different, and one of
 * the two would be a clinical-authoring change rather than a bug fix.
 */

const FAHEMNI = "فاهمني";

describe("countOccurrences", () => {
  it("counts non-overlapping occurrences", () => {
    expect(countOccurrences("aaa", "aa")).toBe(1);
    expect(countOccurrences("abab", "ab")).toBe(2);
    expect(countOccurrences("nothing", "x")).toBe(0);
    expect(countOccurrences("anything", "")).toBe(0);
  });
});

describe("detectRepeatedPhrases", () => {
  it("finds a phrase the model repeated within one turn", () => {
    const text = "ما بنام منيح. فاهمني؟ وبضل أفكر. فاهمني؟";
    expect(detectRepeatedPhrases(text)).toContain("فاهمني؟");
  });

  it("prefers the longest repeated phrase over its fragments", () => {
    const text = "بصير قلبي يدق بسرعة. بصير قلبي يدق بسرعة.";
    const found = detectRepeatedPhrases(text);
    expect(found[0]).toBe("بصير قلبي يدق بسرعة.");
    // Every word also repeats twice, but reporting them separately is noise.
    expect(found).not.toContain("قلبي");
  });

  it("reports nothing when a turn says everything once", () => {
    expect(detectRepeatedPhrases("ما بنام منيح وبضل أفكر بالليل.")).toEqual([]);
  });
});

describe("tracePhrase — where a repetition came from", () => {
  it("attributes an authored repetition to the model", () => {
    const trace = tracePhrase({
      phrase: FAHEMNI,
      displayText: "تعبت كتير. فاهمني؟ وما بقدر أنام. فاهمني؟",
      speechText: "تعبت كتير. فاهمني? وما بقدر أنام. فاهمني?",
      segments: ["تعبت كتير. فاهمني?", "وما بقدر أنام. فاهمني?"],
    });
    expect(trace.counts).toEqual([
      { stage: "model", count: 2 },
      { stage: "speech", count: 2 },
      { stage: "segments", count: 2 },
    ]);
    // Nothing downstream added anything — the persona is the source.
    expect(trace.introducedAt).toBe("model");
  });

  it("attributes a duplication introduced by normalization to the speech layer", () => {
    const trace = tracePhrase({
      phrase: FAHEMNI,
      displayText: "تعبت كتير. فاهمني؟",
      speechText: "تعبت كتير. فاهمني? فاهمني?",
      segments: ["تعبت كتير. فاهمني? فاهمني?"],
    });
    expect(trace.introducedAt).toBe("speech");
  });

  it("attributes a segment duplicated across a boundary to segmentation", () => {
    const trace = tracePhrase({
      phrase: FAHEMNI,
      displayText: "تعبت كتير. فاهمني؟",
      speechText: "تعبت كتير. فاهمني?",
      // The same clause emitted into two segments — it would be heard twice.
      segments: ["تعبت كتير. فاهمني?", "فاهمني?"],
    });
    expect(trace.introducedAt).toBe("segments");
    expect(trace.perSegment).toEqual([1, 1]);
  });

  it("reports null when the phrase never appears", () => {
    const trace = tracePhrase({
      phrase: FAHEMNI,
      displayText: "ما بنام.",
      speechText: "ما بنام.",
      segments: ["ما بنام."],
    });
    expect(trace.introducedAt).toBeNull();
  });
});

describe("traceRepeatedPhrases against the real speech pipeline", () => {
  it("shows the speech layer adds no repetition of its own", () => {
    // Repetition authored into the turn, run through the actual normalizer and
    // segmenter rather than a hand-written approximation.
    const display = "ما بنام منيح. فاهمني؟ وبضل أفكر لحد الصبح. فاهمني؟";
    const prepared = prepareSpeech(display, "ar");

    const traces = traceRepeatedPhrases({
      displayText: display,
      speechText: prepared.speechText,
      segments: prepared.segments.map((s) => s.text),
      watch: [FAHEMNI],
    });

    const fahemni = traces.find((t) => t.phrase === FAHEMNI);
    expect(fahemni).toBeDefined();
    expect(fahemni!.counts[0]!.count).toBe(2);
    // Same count downstream: the layer is not the source.
    expect(fahemni!.counts[1]!.count).toBe(2);
    expect(fahemni!.counts[2]!.count).toBe(2);
    expect(fahemni!.introducedAt).toBe("model");
  });

  it("drops watched phrases that do not occur at all", () => {
    const traces = traceRepeatedPhrases({
      displayText: "ما بنام.",
      speechText: "ما بنام.",
      segments: ["ما بنام."],
      watch: [FAHEMNI],
    });
    expect(traces).toEqual([]);
  });
});

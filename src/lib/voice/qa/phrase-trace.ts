/**
 * Repeated-phrase provenance.
 *
 * Human QA reported the patient saying «فاهمني؟» over and over. A repetition
 * can be introduced at five different places, and the fix is completely
 * different in each case:
 *
 *   1. model response          → prompt / persona authoring
 *   2. speech-text transform   → normalization bug
 *   3. segmentation            → a segment duplicated across a boundary
 *   4. TTS                     → provider repeated the text
 *   5. playback                → a clip played twice
 *
 * Stages 1–3 are decidable from text alone, which is what this module does:
 * count the phrase at each stage and report where the count first increases.
 * Stages 4–5 need the audio, which the QA panel plays back beside this table.
 *
 * Nothing here removes or rewrites anything. Repetition can be authored
 * clinical characterization, and deleting it would be a clinical change.
 */

export type PhraseStageCount = {
  stage: "model" | "speech" | "segments";
  count: number;
};

export type PhraseTrace = {
  phrase: string;
  counts: PhraseStageCount[];
  /** Per-segment occurrences, so a duplicated segment is visible directly. */
  perSegment: number[];
  /**
   * Where the count first exceeds the model's own count, or "model" when the
   * model already repeated it and no later stage added more.
   */
  introducedAt: "model" | "speech" | "segments" | null;
};

/** Count non-overlapping occurrences of `phrase` in `text`. */
export function countOccurrences(text: string, phrase: string): number {
  if (!phrase) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = text.indexOf(phrase, from);
    if (at === -1) return count;
    count += 1;
    from = at + phrase.length;
  }
}

/**
 * Phrases the model repeated within a single turn.
 *
 * Word n-grams rather than sentences, so "فاهمني؟" is caught whether or not it
 * is punctuated consistently. Longer n-grams win: reporting the full repeated
 * phrase is more useful than reporting each of its words.
 */
export function detectRepeatedPhrases(
  text: string,
  options: { minWords?: number; maxWords?: number; minCount?: number } = {},
): string[] {
  const minWords = options.minWords ?? 1;
  const maxWords = options.maxWords ?? 5;
  const minCount = options.minCount ?? 2;

  const words = text.split(/\s+/).filter(Boolean);
  const found = new Map<string, number>();

  for (let size = maxWords; size >= minWords; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const phrase = words.slice(i, i + size).join(" ");
      if (found.has(phrase)) continue;
      const count = countOccurrences(text, phrase);
      if (count >= minCount) found.set(phrase, count);
    }
  }

  // Drop any phrase that is a substring of a longer one repeated as often —
  // otherwise every word of a repeated sentence is reported separately.
  const phrases = [...found.keys()];
  return phrases
    .filter(
      (phrase) =>
        !phrases.some(
          (other) =>
            other !== phrase &&
            other.length > phrase.length &&
            other.includes(phrase) &&
            found.get(other) === found.get(phrase),
        ),
    )
    .sort((a, b) => (found.get(b) ?? 0) - (found.get(a) ?? 0) || b.length - a.length);
}

export function tracePhrase(params: {
  phrase: string;
  displayText: string;
  speechText: string;
  segments: string[];
}): PhraseTrace {
  const model = countOccurrences(params.displayText, params.phrase);
  const speech = countOccurrences(params.speechText, params.phrase);
  const perSegment = params.segments.map((s) =>
    countOccurrences(s, params.phrase),
  );
  const segments = perSegment.reduce((a, b) => a + b, 0);

  let introducedAt: PhraseTrace["introducedAt"] = null;
  if (model > 0) introducedAt = "model";
  if (speech > model) introducedAt = "speech";
  else if (segments > Math.max(model, speech)) introducedAt = "segments";

  return {
    phrase: params.phrase,
    counts: [
      { stage: "model", count: model },
      { stage: "speech", count: speech },
      { stage: "segments", count: segments },
    ],
    perSegment,
    introducedAt,
  };
}

/** Trace every phrase the model repeated, plus any explicitly watched ones. */
export function traceRepeatedPhrases(params: {
  displayText: string;
  speechText: string;
  segments: string[];
  watch?: string[];
}): PhraseTrace[] {
  const detected = detectRepeatedPhrases(params.displayText);
  const phrases = [...new Set([...(params.watch ?? []), ...detected])];
  return phrases
    .map((phrase) =>
      tracePhrase({
        phrase,
        displayText: params.displayText,
        speechText: params.speechText,
        segments: params.segments,
      }),
    )
    .filter((trace) => trace.counts.some((c) => c.count > 0));
}

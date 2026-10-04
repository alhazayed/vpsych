/**
 * Incremental sentence / phrase segmenter for progressive TTS.
 *
 * Fed raw LLM deltas as they stream; returns speakable segments as soon as a
 * sentence boundary is certain. A boundary is terminal punctuation followed by
 * whitespace (so "3.5" and a trailing "." still awaiting its next token are
 * never split), or a newline. Sentences longer than `maxChars` are split at the
 * last safe phrase boundary (comma, semicolon, colon, dash; Arabic ، ؛), then at
 * the last space, and only as a last resort mid-word.
 *
 * Pure and transport-agnostic: used by the stream route to emit `sentence`
 * events. Never decides WHETHER a segment may be spoken — that is the speech
 * release gate's job.
 */

export type SentenceSegmenterOptions = {
  /** Hard ceiling for one segment (TTS chunk). Default 220. */
  maxChars?: number;
  /** A phrase split must leave at least this many chars. Default 40. */
  minPhraseChars?: number;
};

export type SentenceSegmenter = {
  /** Append a streamed delta; returns any segments that are now complete. */
  push: (delta: string) => string[];
  /** End of stream: return whatever remains as a final segment. */
  flush: () => string[];
};

/** Terminal punctuation run (+ closing quotes/brackets) followed by whitespace. */
const SENTENCE_END = /[.!?…؟。]+["'”’»)\]]*(?=\s)|\n+/u;
const PHRASE_BREAK = /[,;:،؛—–](?=\s)/gu;

export function createSentenceSegmenter(
  opts: SentenceSegmenterOptions = {},
): SentenceSegmenter {
  const maxChars = Math.max(20, opts.maxChars ?? 220);
  const minPhraseChars = Math.max(
    1,
    Math.min(maxChars - 1, opts.minPhraseChars ?? 40),
  );
  let buffer = "";

  const take = (end: number, out: string[]) => {
    const segment = buffer.slice(0, end).trim();
    buffer = buffer.slice(end).replace(/^\s+/, "");
    if (segment) out.push(segment);
  };

  const drain = (): string[] => {
    const out: string[] = [];
    for (;;) {
      const m = SENTENCE_END.exec(buffer);
      if (m && m.index + m[0].length <= maxChars) {
        take(m.index + m[0].length, out);
        continue;
      }
      if (buffer.length <= maxChars) break;
      // Over-long run with no sentence end inside the window: phrase split.
      const window = buffer.slice(0, maxChars);
      let cut = -1;
      PHRASE_BREAK.lastIndex = 0;
      for (const pm of window.matchAll(PHRASE_BREAK)) {
        const end = (pm.index ?? 0) + pm[0].length;
        if (end >= minPhraseChars) cut = end;
      }
      if (cut < 0) {
        const space = window.lastIndexOf(" ");
        cut = space >= minPhraseChars ? space : maxChars;
      }
      take(cut, out);
    }
    return out;
  };

  return {
    push(delta) {
      if (!delta) return [];
      buffer += delta;
      return drain();
    },
    flush() {
      const out = drain();
      const rest = buffer.trim();
      buffer = "";
      if (rest) out.push(rest);
      return out;
    },
  };
}

/** Segment a complete text (same rules as streaming). */
export function segmentForSpeech(
  text: string,
  opts?: SentenceSegmenterOptions,
): string[] {
  const seg = createSentenceSegmenter(opts);
  return [...seg.push(text), ...seg.flush()];
}

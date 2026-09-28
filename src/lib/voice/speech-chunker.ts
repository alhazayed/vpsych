/**
 * Phase 9.2 — deterministic sentence/phrase chunking for progressive TTS.
 *
 * Segments patient reply text for speech synthesis only. Does not rewrite,
 * translate, summarize, or alter clinical meaning — join(chunks) preserves
 * semantic content (whitespace may be normalized at boundaries).
 */

/** Soft upper bound — keeps first-chunk TTS short without word-level chatter. */
export const DEFAULT_MAX_SPEECH_CHUNK_CHARS = 180;

/** Prefer not to emit tiny fragments unless they are the whole utterance. */
export const DEFAULT_MIN_SPEECH_CHUNK_CHARS = 24;

/**
 * Sentence terminators (EN + AR) and clause separators used as soft breaks.
 * Terminators stay attached to the preceding phrase.
 */
const TERMINATOR_RE = /([.!?…。؟]+)(\s+|$)/g;
const CLAUSE_RE = /([,،；;]+)(\s+|$)/g;

export type SpeechChunkerOptions = {
  maxChars?: number;
  minChars?: number;
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Split into primary sentences, keeping terminator characters on the left side.
 */
function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let last = 0;
  const re = new RegExp(TERMINATOR_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[1]!.length;
    const slice = text.slice(last, end).trim();
    if (slice) parts.push(slice);
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).trim();
  if (tail) parts.push(tail);
  return parts.length > 0 ? parts : text.trim() ? [text.trim()] : [];
}

/** Soft-split a long sentence on commas / Arabic commas when over max. */
function splitClauses(sentence: string, maxChars: number): string[] {
  if (sentence.length <= maxChars) return [sentence];
  const parts: string[] = [];
  let last = 0;
  const re = new RegExp(CLAUSE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    const end = m.index + m[1]!.length;
    const slice = sentence.slice(last, end).trim();
    if (slice) parts.push(slice);
    last = m.index + m[0].length;
  }
  const tail = sentence.slice(last).trim();
  if (tail) parts.push(tail);
  return parts.length > 0 ? parts : [sentence];
}

/** Hard-split oversized text on whitespace, then by char if needed. */
function hardSplit(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    const out: string[] = [];
    for (let i = 0; i < text.length; i += maxChars) {
      out.push(text.slice(i, i + maxChars));
    }
    return out;
  }
  const out: string[] = [];
  let buf = "";
  for (const word of words) {
    const next = buf ? `${buf} ${word}` : word;
    if (next.length <= maxChars) {
      buf = next;
      continue;
    }
    if (buf) out.push(buf);
    if (word.length <= maxChars) {
      buf = word;
    } else {
      for (let i = 0; i < word.length; i += maxChars) {
        out.push(word.slice(i, i + maxChars));
      }
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out;
}

function endsWithTerminator(phrase: string): boolean {
  return /[.!?…。؟]$/.test(phrase);
}

function isMicroFragment(phrase: string, minChars: number): boolean {
  // True micro-utterances (Mm. / آه.) — coalesce. Terminated sentences stay alone.
  const letters = phrase.replace(/[.!?…。؟،,；;\s]/g, "");
  return letters.length > 0 && letters.length < Math.min(minChars, 8);
}

function packPhrases(
  phrases: string[],
  maxChars: number,
  minChars: number,
): string[] {
  const packed: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf) {
      packed.push(buf);
      buf = "";
    }
  };

  for (const phrase of phrases) {
    if (!phrase) continue;
    if (phrase.length > maxChars) {
      flush();
      for (const piece of hardSplit(phrase, maxChars)) {
        packed.push(piece);
      }
      continue;
    }

    // Prefer one terminated sentence/phrase per chunk (progressive first audio).
    // Only coalesce true micro-fragments into the following phrase.
    if (isMicroFragment(phrase, minChars)) {
      buf = buf ? `${buf} ${phrase}` : phrase;
      continue;
    }

    if (buf) {
      const merged = `${buf} ${phrase}`;
      if (merged.length <= maxChars) {
        packed.push(merged);
      } else {
        flush();
        packed.push(phrase);
      }
      buf = "";
      continue;
    }

    if (endsWithTerminator(phrase) || phrase.length >= minChars) {
      packed.push(phrase);
    } else {
      buf = phrase;
    }
  }
  flush();

  // Merge a trailing micro-chunk into the previous when safe.
  if (packed.length >= 2 && isMicroFragment(packed[packed.length - 1]!, minChars)) {
    const last = packed.pop()!;
    const prev = packed[packed.length - 1]!;
    if (`${prev} ${last}`.length <= maxChars) {
      packed[packed.length - 1] = `${prev} ${last}`;
    } else {
      packed.push(last);
    }
  }

  return packed;
}

/**
 * Segment text for progressive TTS. Deterministic for a given (text, options).
 */
export function chunkTextForSpeechPlayback(
  text: string,
  options: SpeechChunkerOptions = {},
): string[] {
  const maxChars = Math.max(
    40,
    options.maxChars ?? DEFAULT_MAX_SPEECH_CHUNK_CHARS,
  );
  const minChars = Math.max(
    1,
    Math.min(
      options.minChars ?? DEFAULT_MIN_SPEECH_CHUNK_CHARS,
      Math.floor(maxChars / 2),
    ),
  );

  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const sentences = splitSentences(normalized);
  // Single short sentence — one chunk (no progressive benefit).
  if (sentences.length <= 1 && normalized.length <= maxChars) {
    return [normalized];
  }

  const phrases: string[] = [];
  for (const sentence of sentences) {
    // Soft-split long sentences; keep short sentences intact.
    if (sentence.length > maxChars) {
      phrases.push(...splitClauses(sentence, maxChars));
    } else {
      phrases.push(sentence);
    }
  }

  return packPhrases(phrases, maxChars, minChars);
}

/**
 * Reconstruct text from chunks for equivalence checks (whitespace-normalized).
 */
export function joinSpeechChunks(chunks: string[]): string {
  return normalizeWhitespace(chunks.join(" "));
}

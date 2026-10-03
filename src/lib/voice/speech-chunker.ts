/**
 * Phase 9.2 / 9.2R — deterministic sentence/phrase chunking for progressive TTS.
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
 * Hard maximum progressive TTS HTTP requests per patient response.
 *
 * Rationale (Phase 9.2R): `/api/voice/tts` is rate-limited at 60/h/user.
 * Preview already observed 429s after a short English progressive burst.
 * Concurrency stays at {@link DEFAULT_TTS_IN_FLIGHT} (= 2); raising the
 * rate limit is not the first fix. Six chunks still covers typical
 * multi-sentence replies while bounding worst-case fan-out. Responses that
 * cannot safely coalesce into ≤6 chunks (without oversized merges) fall
 * back to a single whole-utterance `legacy_blob` request **before**
 * progressive playback starts — never truncate clinical text, never
 * start progressive then replay.
 */
export const MAX_PROGRESSIVE_TTS_CHUNKS = 6;

/**
 * Ceiling when coalescing over-budget chunks. Above the soft per-chunk
 * target so adjacent sentences can merge, but below “whole essay” size
 * so progressive first-audio benefit remains meaningful. If safe merges
 * still leave more than {@link MAX_PROGRESSIVE_TTS_CHUNKS} pieces, the
 * planner chooses `legacy_blob` (one TTS) instead of unbounded requests.
 */
export const MAX_COALESCED_SPEECH_CHUNK_CHARS = 480;

/**
 * Sentence terminators (EN + AR) and clause separators used as soft breaks.
 * Terminators stay attached to the preceding phrase.
 *
 * Soft/clause set includes Arabic semicolon U+061B (؛) in addition to
 * ASCII `;` and fullwidth `；`.
 */
const TERMINATOR_RE = /([.!?…。؟]+)(\s+|$)/g;
const CLAUSE_RE = /([,،；;؛]+)(\s+|$)/g;

/**
 * Human Conversation Fidelity — first-audio latency. TTS time grows with the
 * length of the text, and nothing is audible until the first chunk is ready.
 * A first sentence longer than this is split at its first natural clause
 * boundary (comma / Arabic comma / semicolon, or before a connective) so the
 * patient starts speaking sooner. Request stitching keeps the intonation
 * continuous across the split. Later chunks are unaffected.
 */
export const FIRST_CHUNK_SOFT_MAX_CHARS = 80;
/** Never create a first chunk shorter than this (no clipped openers). */
const FIRST_CHUNK_MIN_CHARS = 20;

export type SpeechChunkerOptions = {
  maxChars?: number;
  minChars?: number;
  /** Override {@link MAX_PROGRESSIVE_TTS_CHUNKS} (tests). */
  maxChunks?: number;
  /** Override {@link MAX_COALESCED_SPEECH_CHUNK_CHARS} (tests). */
  maxCoalescedChars?: number;
  /** Override {@link FIRST_CHUNK_SOFT_MAX_CHARS}; 0 disables the split. */
  firstChunkSoftMaxChars?: number;
};

export type SpeechPlaybackPlan =
  | {
      mode: "progressive";
      chunks: string[];
    }
  | {
      mode: "legacy_blob";
      /** Full utterance text for one TTS request (clinical text preserved). */
      text: string;
      reason: "exceeds_chunk_budget";
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

/** Soft-split a long sentence on commas / Arabic commas / semicolons when over max. */
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

/**
 * Words before which a spoken phrase boundary sounds natural (connectives).
 * Matched after stripping Arabic tashkeel/tatweel. EN + AR (MSA/Levantine).
 */
const BREAK_BEFORE = new Set([
  "and", "but", "or", "so", "because", "although", "though", "which",
  "when", "while", "then", "if", "unless", "until",
  "و", "لكن", "ولكن", "بس", "لأن", "لان", "لأنه", "لانه", "عشان", "علشان",
  "اللي", "الذي", "التي", "حتى", "لما", "إذا", "اذا", "لو", "وبعدين", "بعدين",
  "يعني", "ثم", "أو", "او", "ولا",
]);

/**
 * Words that must not END a chunk (they bind to the following word):
 * articles, prepositions, complementizers. "أنا أعتقد أن" | "حالتك…" would
 * be an audible broken boundary.
 */
const NO_BREAK_AFTER = new Set([
  "the", "a", "an", "to", "of", "in", "on", "at", "for", "with", "from",
  "my", "your", "his", "her", "their", "our", "this", "that", "very",
  "أن", "ان", "إن", "انه", "أنه", "إنه", "في", "على", "عن", "من", "مع",
  "إلى", "الى", "لـ", "بـ", "الـ", "هذا", "هذه", "هاد", "هاي", "كثير", "جدا",
  "و", "ف",
]);

function normBreakWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Choose where to break a word buffer that is about to overflow. Returns the
 * index of the first word of the NEXT chunk (1..words.length-1), preferring
 * the last connective in the back half, then avoiding a dangling
 * function word, else the greedy position.
 */
function naturalBreakIndex(words: string[], maxChars: number): number {
  const n = words.length;
  // Prefer a connective boundary in the back half of the buffer.
  let length = 0;
  const startAt: number[] = [];
  for (let i = 0; i < n; i++) {
    startAt.push(length);
    length += words[i]!.length + (i > 0 ? 1 : 0);
  }
  for (let i = n - 1; i >= 1; i--) {
    if (startAt[i]! < maxChars * 0.5) break;
    if (BREAK_BEFORE.has(normBreakWord(words[i]!))) return i;
  }
  // Otherwise do not end on a function word.
  let idx = n;
  while (idx > 1 && NO_BREAK_AFTER.has(normBreakWord(words[idx - 1]!))) {
    idx -= 1;
  }
  return idx === n ? n : Math.max(1, idx);
}

/**
 * Hard-split oversized text on whitespace (at natural phrase boundaries where
 * possible), then by char if a single token exceeds maxChars. Text content
 * and word order are preserved exactly.
 */
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
  let buf: string[] = [];
  const bufLen = () => buf.join(" ").length;
  for (const word of words) {
    const nextLen = buf.length === 0 ? word.length : bufLen() + 1 + word.length;
    if (nextLen <= maxChars) {
      buf.push(word);
      continue;
    }
    if (buf.length > 0) {
      const cut = naturalBreakIndex(buf, maxChars);
      out.push(buf.slice(0, cut).join(" "));
      buf = buf.slice(cut);
    }
    // Carry-over plus the new word may still overflow — flush greedily.
    while (buf.length > 0 && bufLen() + 1 + word.length > maxChars) {
      out.push(buf.join(" "));
      buf = [];
    }
    if (word.length <= maxChars) {
      buf.push(word);
    } else {
      for (let i = 0; i < word.length; i += maxChars) {
        out.push(word.slice(i, i + maxChars));
      }
    }
  }
  if (buf.length > 0) out.push(buf.join(" "));
  return out;
}

function endsWithTerminator(phrase: string): boolean {
  return /[.!?…。؟]$/.test(phrase);
}

function isMicroFragment(phrase: string, minChars: number): boolean {
  // True micro-utterances (Mm. / آه.) — coalesce. Terminated sentences stay alone.
  // Include Arabic semicolon U+061B in strip set.
  const letters = phrase.replace(/[.!?…。؟،,；;؛\s]/g, "");
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
 * Does **not** apply the progressive chunk-count budget — use
 * {@link planSpeechChunksForPlayback} before issuing TTS.
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

/**
 * Merge adjacent chunks from the tail when the merge fits `maxCoalescedChars`,
 * preserving earlier chunks for first-audio latency. Returns null when the
 * result still exceeds `maxChunks` (caller should use legacy_blob).
 */
export function coalesceSpeechChunksToBudget(
  chunks: string[],
  maxChunks: number,
  maxCoalescedChars: number,
): string[] | null {
  if (chunks.length === 0) return [];
  if (chunks.length <= maxChunks) return [...chunks];

  const out = [...chunks];
  let guard = out.length * out.length + 4;
  while (out.length > maxChunks && guard-- > 0) {
    let mergedAny = false;
    // Prefer merging later pairs so chunk 0 stays short when possible.
    for (let i = out.length - 1; i >= 1; i--) {
      const merged = `${out[i - 1]} ${out[i]}`;
      if (merged.length <= maxCoalescedChars) {
        out[i - 1] = merged;
        out.splice(i, 1);
        mergedAny = true;
        break;
      }
    }
    if (!mergedAny) break;
  }

  if (out.length > maxChunks) return null;
  return out;
}

/**
 * Split an over-long FIRST chunk at its earliest natural boundary within
 * [FIRST_CHUNK_MIN_CHARS, softMax]: clause punctuation first, else before a
 * connective. Returns the chunks unchanged when no natural split exists.
 */
export function splitLongFirstChunk(
  chunks: string[],
  softMax: number = FIRST_CHUNK_SOFT_MAX_CHARS,
): string[] {
  const first = chunks[0];
  if (!first || softMax <= 0 || first.length <= softMax) return chunks;

  let cut = -1;
  const clause = new RegExp(CLAUSE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = clause.exec(first)) !== null) {
    const end = m.index + m[1]!.length;
    if (end > softMax) break;
    if (end >= FIRST_CHUNK_MIN_CHARS) {
      cut = end;
      break;
    }
  }
  if (cut < 0) {
    // No early clause punctuation: break before a connective instead.
    const words = first.split(" ");
    let pos = 0;
    for (let i = 0; i < words.length; i++) {
      if (
        i > 0 &&
        pos - 1 >= FIRST_CHUNK_MIN_CHARS &&
        pos - 1 <= softMax &&
        BREAK_BEFORE.has(normBreakWord(words[i]!))
      ) {
        cut = pos - 1;
        break;
      }
      pos += words[i]!.length + 1;
    }
  }
  if (cut < 0) return chunks;
  const head = first.slice(0, cut).trim();
  const tail = first.slice(cut).trim();
  // Never leave a clipped micro-tail ("…, ok.") as its own chunk.
  if (!head || tail.length < FIRST_CHUNK_MIN_CHARS) return chunks;
  return [head, tail, ...chunks.slice(1)];
}

/**
 * Plan TTS playback for one patient response under the progressive chunk budget.
 *
 * - Normal replies → progressive chunks (≤ {@link MAX_PROGRESSIVE_TTS_CHUNKS}).
 * - Over budget → coalesce within {@link MAX_COALESCED_SPEECH_CHUNK_CHARS}.
 * - Still over budget → `legacy_blob` **before** any progressive playback.
 * - Clinical text is never truncated or rewritten (whitespace-normalized only).
 */
export function planSpeechChunksForPlayback(
  text: string,
  options: SpeechChunkerOptions = {},
): SpeechPlaybackPlan {
  const maxChunks = Math.max(
    1,
    options.maxChunks ?? MAX_PROGRESSIVE_TTS_CHUNKS,
  );
  const maxCoalescedChars = Math.max(
    options.maxChars ?? DEFAULT_MAX_SPEECH_CHUNK_CHARS,
    options.maxCoalescedChars ?? MAX_COALESCED_SPEECH_CHUNK_CHARS,
  );

  const normalized = normalizeWhitespace(text);
  const chunks = chunkTextForSpeechPlayback(text, options);

  if (chunks.length === 0) {
    // Empty — pipeline handles as interrupted; surface as progressive empty.
    return { mode: "progressive", chunks: [] };
  }

  if (chunks.length <= maxChunks) {
    // Faster first audio when a split still fits the request budget.
    const firstSplit = splitLongFirstChunk(
      chunks,
      options.firstChunkSoftMaxChars ?? FIRST_CHUNK_SOFT_MAX_CHARS,
    );
    return {
      mode: "progressive",
      chunks: firstSplit.length <= maxChunks ? firstSplit : chunks,
    };
  }

  const coalesced = coalesceSpeechChunksToBudget(
    chunks,
    maxChunks,
    maxCoalescedChars,
  );

  if (coalesced && coalesced.length <= maxChunks) {
    // Sanity: clinical text preserved.
    if (joinSpeechChunks(coalesced) !== joinSpeechChunks(chunks)) {
      return {
        mode: "legacy_blob",
        text: normalized,
        reason: "exceeds_chunk_budget",
      };
    }
    return { mode: "progressive", chunks: coalesced };
  }

  return {
    mode: "legacy_blob",
    text: normalized,
    reason: "exceeds_chunk_budget",
  };
}

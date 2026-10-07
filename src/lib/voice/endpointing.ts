/**
 * Human Conversation Fidelity — natural endpointing (presentation only).
 *
 * Decides whether a therapist pause is the END of a thought or just a pause
 * inside one. A fixed silence threshold cannot tell "أنا من فترة…" (likely
 * unfinished) from "أنا من فترة ما بنام منيح." (finished), so the endpoint
 * combines:
 *
 *   - silence duration (from the energy VAD)
 *   - voiced speech duration (very short bursts are often false starts)
 *   - linguistic cues on the speculative transcript (trailing conjunctions,
 *     prepositions, hesitation sounds, ellipses, question marks, short
 *     acknowledgements) in English and Arabic (MSA + Jordanian/Levantine)
 *
 * The output is a REQUIRED SILENCE budget, bounded to
 * [ENDPOINT_TIMING.completeSilenceMs, ENDPOINT_TIMING.maxSilenceMs] — natural,
 * never open-ended. Transcripts are inspected in memory only; nothing here is
 * logged or persisted. Does not own clinical cognition.
 */

export type EndpointLocale = "en" | "ar";

export type UtteranceCompleteness = "complete" | "incomplete" | "uncertain";

/**
 * Silence budgets (ms after the last voiced frame).
 *
 * `completeSilenceMs` equals the pre-existing hands-free default (850 ms) so a
 * clearly finished thought is committed no later than before. Unfinished
 * thoughts get extra room; `maxSilenceMs` is the hard ceiling at which the
 * VAD force-commits regardless of transcript state.
 */
export const ENDPOINT_TIMING = {
  /**
   * Silence that starts the speculative transcript (stage 1). Shorter than
   * `completeSilenceMs` so the transcript is usually back by the time a
   * finished thought may commit; it never commits anything by itself.
   */
  speculativePauseMs: 500,
  completeSilenceMs: 850,
  uncertainSilenceMs: 1500,
  incompleteSilenceMs: 2000,
  maxSilenceMs: 2200,
  /** Voiced speech shorter than this is treated as at least "uncertain". */
  shortSpeechMs: 900,
  /** Continuous re-voicing needed to count as "therapist resumed". */
  resumeMinMs: 150,
} as const;

/** Tunable shape of {@link ENDPOINT_TIMING} (tests / future config). */
export type EndpointTiming = { [K in keyof typeof ENDPOINT_TIMING]: number };

/** Hesitation / filler tokens (EN + AR). Never generated — only detected. */
const HESITATIONS = new Set([
  "um",
  "umm",
  "uh",
  "uhh",
  "uhm",
  "er",
  "erm",
  "hmm",
  "امم",
  "اممم",
  "ام",
  "اه",
  "ااه",
  "ااا",
  "إمم",
  "يعني",
]);

/** Words that almost never end a finished English thought. */
const EN_TRAILING_INCOMPLETE = new Set([
  "and",
  "but",
  "or",
  "so",
  "because",
  "cause",
  "cos",
  "if",
  "when",
  "while",
  "although",
  "unless",
  "until",
  "the",
  "a",
  "an",
  "to",
  "of",
  "with",
  "about",
  "from",
  "my",
  "your",
  "his",
  "her",
  "their",
  "our",
  "i",
  "i'm",
  "im",
  "we",
  "kind",
  "sort",
]);

/**
 * Arabic tokens that rarely close a thought: conjunctions, prepositions,
 * complementizers, relative pronouns (MSA + Jordanian/Levantine forms).
 * Matched after stripping tatweel and diacritics.
 */
const AR_TRAILING_INCOMPLETE = new Set([
  "و",
  "ف",
  "بس",
  "لكن",
  "بل",
  "او",
  "أو",
  "لان",
  "لأن",
  "لانه",
  "لأنه",
  "لانو",
  "لإنو",
  "عشان",
  "علشان",
  "مشان",
  "منشان",
  "انه",
  "إنه",
  "أنه",
  "انو",
  "إنو",
  "ان",
  "إن",
  "أن",
  "اللي",
  "الذي",
  "التي",
  "في",
  "فى",
  "على",
  "عن",
  "من",
  "مع",
  "الى",
  "إلى",
  "لل",
  "زي",
  "مثل",
  "حتى",
  "لما",
  "لمّا",
  "اذا",
  "إذا",
  "لو",
  "كمان",
  "بعدين",
  "وبعدين",
  "يعني",
  "ال",
  "الـ",
  "انا",
  "أنا",
]);

/** Short replies that are complete on their own (no need to wait longer). */
const ACKNOWLEDGEMENTS = new Set([
  "yes",
  "yeah",
  "yep",
  "no",
  "nope",
  "okay",
  "ok",
  "sure",
  "right",
  "thanks",
  "thank you",
  "got it",
  "i see",
  "mm-hmm",
  "go on",
  "تمام",
  "طيب",
  "ماشي",
  "اه",
  "آه",
  "أه",
  "اي",
  "إي",
  "ايوه",
  "أيوه",
  "ايوا",
  "نعم",
  "لا",
  "صح",
  "مزبوط",
  "مظبوط",
  "اوكي",
  "أوكي",
  "شكرا",
  "فهمت",
  "مفهوم",
  "كمل",
  "كملي",
  "احكيلي",
  "تفضل",
  "تفضلي",
]);

const ARABIC_DIACRITICS = /[ً-ْٰـ]/g; // tashkeel + tatweel
const TRAILING_PUNCT = /[\s.!?؟…,،;؛:"'«»)\]-]+$/u;

/** Normalize a token for set lookups (lowercase, no tashkeel/tatweel). */
function normToken(token: string): string {
  return token
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, "");
}

function tokens(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normToken)
    .filter((t) => t.length > 0);
}

/**
 * Arabic attaches و/ف/ب/ل to the following word; a bare trailing proclitic
 * (e.g. "و" or "الـ" spoken before a pause) is a strong unfinished cue.
 * An English word glued to "الـ" ("الـmedication") is a complete noun.
 */
function isTrailingArabicIncomplete(last: string): boolean {
  if (AR_TRAILING_INCOMPLETE.has(last)) return true;
  // "وال" / "بال" / "لل" fragments
  return /^(و|ف|ب|ل)?ال$/.test(last);
}

/**
 * Classify a (speculative) transcript as a complete or unfinished thought.
 * Locale-agnostic token checks are applied to both languages because
 * therapists code-switch ("أنا أخذت الـmedication مبارح بس").
 */
export function classifyUtteranceCompleteness(
  text: string,
): UtteranceCompleteness {
  const raw = text.trim();
  if (!raw) return "uncertain";

  // Explicit trailing hesitation punctuation from STT: "…" / "..." / "-".
  if (/(\.\.\.|…|—|-)\s*$/u.test(raw)) return "incomplete";
  // Trailing comma = clause still open.
  if (/[,،;؛]\s*$/u.test(raw)) return "incomplete";

  const words = tokens(raw);
  if (words.length === 0) return "uncertain";

  const joined = words.join(" ");
  if (ACKNOWLEDGEMENTS.has(joined)) return "complete";

  const last = words[words.length - 1]!;
  if (HESITATIONS.has(last)) return "incomplete";
  if (EN_TRAILING_INCOMPLETE.has(last)) return "incomplete";
  if (isTrailingArabicIncomplete(last)) return "incomplete";

  const stripped = raw.replace(TRAILING_PUNCT, "");
  const endsWithQuestion = /[?؟]\s*$/u.test(raw);
  if (endsWithQuestion && stripped.length > 0) return "complete";

  // Very short non-acknowledgement fragments ("أنا من فترة", "I've been")
  // are ambiguous — give the speaker a little more room.
  if (words.length <= 3) return "uncertain";

  return "complete";
}

/**
 * Required trailing silence before committing the therapist turn.
 * Always within [completeSilenceMs, maxSilenceMs].
 */
export function requiredEndpointSilenceMs(params: {
  completeness: UtteranceCompleteness;
  /** Voiced speech duration in the current capture (ms). */
  speechMs: number;
  timing?: Partial<EndpointTiming>;
}): number {
  const t = { ...ENDPOINT_TIMING, ...params.timing };
  let required: number;
  switch (params.completeness) {
    case "complete":
      required = t.completeSilenceMs;
      break;
    case "incomplete":
      required = t.incompleteSilenceMs;
      break;
    default:
      required = t.uncertainSilenceMs;
  }
  if (params.speechMs < t.shortSpeechMs && params.completeness !== "complete") {
    required = Math.max(required, t.uncertainSilenceMs);
  }
  return Math.max(t.completeSilenceMs, Math.min(t.maxSilenceMs, required));
}

export type EndpointDecision =
  | { action: "commit"; requiredSilenceMs: number }
  | { action: "wait"; requiredSilenceMs: number; remainingMs: number };

/** Combine completeness + elapsed silence into commit / wait. */
export function decideEndpoint(params: {
  completeness: UtteranceCompleteness;
  speechMs: number;
  silenceMs: number;
  timing?: Partial<EndpointTiming>;
}): EndpointDecision {
  const requiredSilenceMs = requiredEndpointSilenceMs(params);
  if (params.silenceMs >= requiredSilenceMs) {
    return { action: "commit", requiredSilenceMs };
  }
  return {
    action: "wait",
    requiredSilenceMs,
    remainingMs: requiredSilenceMs - params.silenceMs,
  };
}

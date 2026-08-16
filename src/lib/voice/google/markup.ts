/**
 * Google Chirp 3 HD pause markup — provider-local only.
 *
 * WHAT THIS IS NOT:
 * - It does not rewrite clinical dialogue. Words, order, spelling, and
 *   diacritics are untouched.
 * - It does not call an LLM.
 * - It does not touch the patient agent, ASPE output, or the clinical
 *   emotion/pause engines. `pause_scale` is already produced upstream by
 *   `lib/clinical-voice`; this module only decides how to express that
 *   existing, provider-independent number in Google's syntax.
 *
 * WHAT IT DOES:
 * Inserts Google's documented `[pause short]` / `[pause long]` tags at
 * SENTENCE BOUNDARIES ONLY, into the `markup` input field, when pause control
 * is both documented for the voice/locale and explicitly enabled.
 *
 * INJECTION SAFETY:
 * Patient dialogue is model-generated text and must be treated as untrusted
 * with respect to markup. Before any tag is added, every square bracket in the
 * clinical text is neutralized to a round bracket, so no upstream content can
 * emit a `[pause …]` tag (or any future markup tag) of its own. Brackets are
 * not phonated differently from parentheses by TTS, so this is a punctuation
 * substitution with no effect on spoken meaning.
 */

/**
 * Sentence-final punctuation across both locales.
 * Arabic full stop is the same U+002E; U+061F is the Arabic question mark and
 * U+06D4 the Urdu/Arabic full stop. The Arabic comma (U+060C) is deliberately
 * excluded — it is not a sentence boundary.
 */
const SENTENCE_END = /([.!?؟۔…]+)(\s+)/g;

/** Never emit more tags than this, whatever the input looks like. */
const MAX_PAUSE_TAGS = 24;

export type GooglePauseTag = "[pause short]" | "[pause long]";

export type PauseMarkupResult = {
  /** Text safe to send in `input.markup`, or in `input.text` when no tags. */
  text: string;
  /** True when at least one pause tag was inserted. */
  applied: boolean;
  /** How many tags were inserted. */
  tagCount: number;
  /** The tag used, when any. */
  tag: GooglePauseTag | null;
  /** True when a bracket in the source text was neutralized. */
  sanitized: boolean;
};

/**
 * Neutralize markup-significant characters in untrusted clinical text.
 * `[` → `(` and `]` → `)`.
 */
export function escapeGoogleMarkup(text: string): {
  text: string;
  sanitized: boolean;
} {
  if (!/[[\]]/.test(text)) return { text, sanitized: false };
  return { text: text.replace(/\[/g, "(").replace(/\]/g, ")"), sanitized: true };
}

/**
 * Choose a pause tag from the clinical `pause_scale` (1.0 = baseline).
 * Below the short threshold, the natural prosody of the voice is left alone —
 * adding a tag everywhere would sound worse, not more clinical.
 */
export function pauseTagForScale(
  pauseScale: number | null | undefined,
): GooglePauseTag | null {
  if (typeof pauseScale !== "number" || !Number.isFinite(pauseScale)) {
    return null;
  }
  if (pauseScale >= 1.6) return "[pause long]";
  if (pauseScale >= 1.2) return "[pause short]";
  return null;
}

/**
 * Build the Chirp 3 HD markup payload.
 *
 * Tags are placed only *after* sentence-final punctuation that is already
 * followed by whitespace, so no word is split and no punctuation is removed.
 * The final sentence never receives a trailing pause.
 */
export function buildPauseMarkup(params: {
  text: string;
  pauseScale?: number | null;
  /** Both documented-for-this-voice AND enabled by configuration. */
  enabled: boolean;
}): PauseMarkupResult {
  const escaped = escapeGoogleMarkup(params.text);
  const tag = params.enabled ? pauseTagForScale(params.pauseScale) : null;

  if (!tag) {
    return {
      text: escaped.text,
      applied: false,
      tagCount: 0,
      tag: null,
      sanitized: escaped.sanitized,
    };
  }

  let inserted = 0;
  const withTags = escaped.text.replace(
    SENTENCE_END,
    (match, punctuation: string, gap: string) => {
      if (inserted >= MAX_PAUSE_TAGS) return match;
      inserted += 1;
      // Punctuation is preserved verbatim; the tag is additive.
      return `${punctuation} ${tag}${gap}`;
    },
  );

  return {
    text: withTags,
    applied: inserted > 0,
    tagCount: inserted,
    tag: inserted > 0 ? tag : null,
    sanitized: escaped.sanitized,
  };
}

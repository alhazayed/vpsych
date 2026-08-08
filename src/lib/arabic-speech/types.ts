/**
 * Arabic Speech Preparation Engine (ASPE).
 *
 * Transforms Arabic dialogue into TTS-safe orthography for Arabic-capable
 * synthesizers (e.g. ElevenLabs). Does not rewrite, translate, summarize,
 * or clinically modify meaning — pronunciation accuracy only.
 */

export type ArabicSpeechDialectHint =
  | "msa"
  | "levantine"
  | "jordanian"
  | (string & {});

export type ArabicSpeechPrepOptions = {
  /** Expand Latin clinical abbreviations (ADHD, OCD, …). Default true. */
  expandAbbreviations?: boolean;
  /** Expand digit + unit patterns ("3 أيام" → "ثلاثة أيام"). Default true. */
  expandNumbers?: boolean;
  /** Apply selective clinical / ambiguous-word tashkeel. Default true. */
  applyTashkeel?: boolean;
  /** Strip markdown / emoji noise that TTS would read aloud. Default true. */
  sanitizeMarkup?: boolean;
  /**
   * Dialect / register hint. ASPE never rewrites dialect into MSA or vice
   * versa — the hint is reserved for future pronunciation lexicons and is
   * accepted so callers can pass CVP / personality dialect through.
   */
  dialect?: ArabicSpeechDialectHint | null;
};

export type ArabicSpeechPrepTransform =
  | "sanitize"
  | "abbreviations"
  | "numbers"
  | "tashkeel"
  | "names";

export type ArabicSpeechPrepResult = {
  /** Speech-ready Arabic (or original when no Arabic / no changes). */
  text: string;
  /** True when orthography changed. */
  changed: boolean;
  /** Which transform stages produced a diff. */
  applied: ArabicSpeechPrepTransform[];
};

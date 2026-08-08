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
   * When true, attach full identification analysis on the result.
   * Default true — cheap and useful for tests / telemetry.
   */
  includeAnalysis?: boolean;
  /**
   * Dialect / register hint. ASPE never rewrites dialect into MSA or vice
   * versa — the hint is reserved for future pronunciation lexicons and is
   * accepted so callers can pass CVP / personality dialect through.
   */
  dialect?: ArabicSpeechDialectHint | null;
  /**
   * TTS-only display_name → speech_name overrides.
   * Never guessed; unknown names are left unchanged.
   * Does not mutate stored avatar / transcript identity.
   */
  speechNameOverrides?: Readonly<Record<string, string>> | null;
};

/** Identification categories (steps 1–6). */
export type ArabicSpeechFindingKind =
  | "ambiguity"
  | "medical"
  | "name"
  | "abbreviation"
  | "number"
  | "tts_risk";

export type ArabicSpeechFinding = {
  kind: ArabicSpeechFindingKind;
  /** Exact surface span in the analyzed string. */
  surface: string;
  start: number;
  end: number;
  /** Minimal speech-ready replacement, when needed. */
  suggested?: string;
  reason?: string;
};

/** Steps 1–6 identification report. */
export type ArabicSpeechAnalysis = {
  ambiguities: ArabicSpeechFinding[];
  medicalTerms: ArabicSpeechFinding[];
  names: ArabicSpeechFinding[];
  abbreviations: ArabicSpeechFinding[];
  numbers: ArabicSpeechFinding[];
  ttsRisks: ArabicSpeechFinding[];
  /** Non-overlapping actionable corrections (apply end→start). */
  corrections: ArabicSpeechFinding[];
};

export type ArabicSpeechPrepTransform =
  | "sanitize"
  | "abbreviations"
  | "numbers"
  | "tashkeel"
  | "names"
  | "identify"
  | "correct";

export type ArabicSpeechPrepResult = {
  /** Speech-ready Arabic (or original when no Arabic / no changes). */
  text: string;
  /** True when orthography changed. */
  changed: boolean;
  /** Which transform stages produced a diff / ran. */
  applied: ArabicSpeechPrepTransform[];
  /** Identification report (steps 1–6), when includeAnalysis !== false. */
  analysis?: ArabicSpeechAnalysis;
};

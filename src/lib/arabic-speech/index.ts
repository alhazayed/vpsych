/**
 * Arabic Speech Preparation Engine (ASPE).
 *
 * Deterministic orthography prep for Arabic TTS — identify then minimal
 * correct. Never rewrites clinical meaning or dialect.
 */

export type {
  ArabicSpeechAnalysis,
  ArabicSpeechDialectHint,
  ArabicSpeechFinding,
  ArabicSpeechFindingKind,
  ArabicSpeechPrepOptions,
  ArabicSpeechPrepResult,
  ArabicSpeechPrepTransform,
} from "./types";

export {
  containsArabicScript,
  hasTashkeel,
  stripTashkeel,
} from "./detect";

export {
  CLINICAL_ABBREVIATION_EXPANSIONS,
  expandClinicalAbbreviations,
} from "./abbreviations";

export {
  CLINICAL_TASHKEEL_LEXICON,
  NAME_TASHKEEL_LEXICON,
  applyClinicalTashkeel,
  applyNameTashkeel,
} from "./medical-terms";

export {
  expandArabicNumbers,
  findExpandableNumberMatches,
} from "./numbers";

export { sanitizeForTts } from "./sanitize";

export { analyzeArabicSpeech, applyFindings } from "./analyze";

export { prepareArabicSpeech, prepareArabicSpeechText } from "./prepare";

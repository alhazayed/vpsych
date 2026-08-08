/**
 * Arabic Speech Preparation Engine (ASPE).
 *
 * Deterministic orthography prep for Arabic TTS — selective tashkeel,
 * number/abbreviation expansion. Never rewrites clinical meaning or dialect.
 */

export type {
  ArabicSpeechDialectHint,
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

export { expandArabicNumbers } from "./numbers";

export { sanitizeForTts } from "./sanitize";

export { prepareArabicSpeech, prepareArabicSpeechText } from "./prepare";

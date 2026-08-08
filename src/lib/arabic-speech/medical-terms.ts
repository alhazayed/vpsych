/**
 * Selective clinical / name tashkeel application helpers.
 * Lexicon data lives in dictionary.ts / names.ts.
 */

import { hasTashkeel, stripTashkeel } from "./detect";
import { medicalDictionaryLexicon } from "./dictionary";
import { resolveSpeechNameLexicon } from "./names";

/** @deprecated Prefer medicalDictionaryLexicon(); kept for barrel compatibility. */
export const CLINICAL_TASHKEEL_LEXICON = medicalDictionaryLexicon();

/** @deprecated Prefer resolveSpeechNameLexicon(); catalog default only. */
export const NAME_TASHKEEL_LEXICON = resolveSpeechNameLexicon();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Apply lexicon replacements as whole-phrase matches.
 * Skips a match when the surface already has tashkeel (caller already guided).
 * Preserves a single-letter Arabic clitic prefix (و / ف / ب / ك / ل).
 */
export function applyLexicon(
  text: string,
  lexicon: ReadonlyArray<readonly [string, string]>,
): string {
  let out = text;
  for (const [raw, guided] of lexicon) {
    const key = stripTashkeel(raw);
    const re = new RegExp(
      `(?<![\\u0600-\\u06FF])([وفبكل]?)(${escapeRegExp(key)})(?![\\u0600-\\u06FF])`,
      "g",
    );
    out = out.replace(re, (_full, clitic: string, word: string) => {
      if (hasTashkeel(word)) return `${clitic}${word}`;
      return `${clitic}${guided}`;
    });
  }
  return out;
}

export function applyClinicalTashkeel(text: string): string {
  return applyLexicon(text, medicalDictionaryLexicon());
}

export function applyNameTashkeel(
  text: string,
  speechNameOverrides?: Readonly<Record<string, string>> | null,
): string {
  return applyLexicon(text, resolveSpeechNameLexicon(speechNameOverrides));
}

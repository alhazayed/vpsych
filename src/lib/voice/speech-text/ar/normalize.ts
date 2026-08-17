/**
 * Arabic speech-text normalization.
 *
 * Conservative by design. This normalizer improves HOW existing Arabic is
 * voiced. It never rewrites sentences, never translates, never converts
 * Jordanian colloquial vocabulary into MSA, and never blanket-diacritizes.
 *
 * Everything here operates on the SPEECH representation only. The display /
 * persisted transcript is untouched.
 */

import {
  AR_ABBREVIATIONS,
  AR_CARDINALS,
  AR_CONTEXTUAL_DIACRITICS,
  AR_LATIN_TRANSLITERATIONS,
} from "@/lib/voice/speech-text/lexicon-ar";
import type { NormalizeResult } from "@/lib/voice/speech-text/types";

/** Tatweel (kashida) is decorative elongation and confuses grapheme mapping. */
const TATWEEL = /ـ/g;
/** Zero-width + bidi control characters that survive copy/paste. */
const INVISIBLES = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
/** Arabic-Indic and extended Arabic-Indic digits. */
const AR_DIGITS = /[٠-٩۰-۹]/g;
/**
 * Asterisk markers the prompt forbids — defence in depth, not a rewrite.
 *
 * ONLY the marker characters are removed; the enclosed text is always kept.
 * Deleting the span was a clinical-semantic defect: this layer cannot tell a
 * stage direction from emphasis, so `أنا *مش* مبسوط` ("I am NOT happy") lost
 * its negation and became "I am happy", and `بحس *بضيق*` lost the symptom.
 *
 * The asymmetry is deliberate. A leaked stage direction is voiced as one extra
 * word — audible, obvious, clinically harmless. A deleted negation or symptom
 * is silent and inverts clinical meaning. Never delete.
 */
const ASTERISK_MARKERS = /\*/g;

function arabicDigitToWestern(ch: string): string {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
  return ch;
}

/**
 * Map Arabic punctuation onto its ASCII equivalent for the speech
 * representation only.
 *
 * Rationale: TTS prosody is driven by ASCII punctuation far more reliably than
 * by the Arabic-specific codepoints, so `؟` frequently produces a flat
 * declarative contour where `?` produces question intonation. The Arabic
 * characters remain in the display text.
 */
export function normalizeArabicPunctuation(input: string): string {
  return input
    .replace(/؟/g, "?") // ؟
    .replace(/،/g, ",") // ،
    .replace(/؛/g, ";") // ؛
    .replace(/٫/g, ".") // ٫ decimal separator
    .replace(/٬/g, ","); // ٬ thousands separator
}

/** Spell out unambiguous cardinals; leave everything else as Western digits. */
export function spellArabicNumbers(input: string): string {
  // Skip anything that is part of a compound number — "2.5" and "10:30" must
  // stay intact rather than be spelled piecewise. A trailing sentence period is
  // NOT a separator, so "بعمر 20." still spells correctly.
  return input.replace(/(?<![\d.,:])\d+(?![.,:]?\d)/g, (digits) => {
    if (digits.length > 4) return digits;
    const value = Number(digits);
    if (!Number.isFinite(value)) return digits;
    const word = AR_CARDINALS[value];
    return word ?? digits;
  });
}

function replaceWholeTokens(
  input: string,
  table: Record<string, string>,
  opts: { caseInsensitive?: boolean } = {},
): string {
  let out = input;
  for (const [from, to] of Object.entries(table)) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Arabic has no case and no \b support for Arabic script in JS RegExp, so
    // token boundaries are expressed as "not an Arabic/Latin letter or digit".
    const boundary = "[^\\p{L}\\p{N}]";
    const re = new RegExp(
      `(^|${boundary})${escaped}(?=${boundary}|$)`,
      opts.caseInsensitive ? "giu" : "gu",
    );
    out = out.replace(re, (_m, lead: string) => `${lead}${to}`);
  }
  return out;
}

/** Transliterate known Latin-script clinical tokens into Arabic script. */
export function transliterateLatinTokens(input: string): string {
  return replaceWholeTokens(input, AR_LATIN_TRANSLITERATIONS, {
    caseInsensitive: true,
  });
}

/** Expand the small set of Arabic abbreviations that are otherwise spelled. */
export function expandArabicAbbreviations(input: string): string {
  return replaceWholeTokens(input, AR_ABBREVIATIONS);
}

/**
 * Restore gemination on high-frequency Levantine words the model often writes
 * without shadda. Vocabulary and dialect are preserved exactly.
 */
export function applyContextualDiacritics(input: string): string {
  return replaceWholeTokens(input, AR_CONTEXTUAL_DIACRITICS);
}

/** Collapse whitespace and give punctuation consistent spacing for prosody. */
export function tidySpeechWhitespace(input: string): string {
  return input
    .replace(/…/g, "...")
    .replace(/\s*\.{3,}\s*/g, "... ")
    .replace(/\s+([,;:.!?])/g, "$1")
    .replace(/([,;:])(?=[^\s\d])/g, "$1 ")
    .replace(/([.!?])(?=[^\s.!?\d])/g, "$1 ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n+ */g, " ")
    .trim();
}

/**
 * Full Arabic speech normalization pipeline.
 * Order matters: strip noise → transliterate/expand → digits → punctuation →
 * diacritics → whitespace.
 */
export function normalizeArabicSpeech(input: string): NormalizeResult {
  const original = input;

  let text = input.replace(INVISIBLES, "").replace(ASTERISK_MARKERS, "");

  text = text.replace(AR_DIGITS, arabicDigitToWestern);
  // Transliterate BEFORE stripping tatweel: "الـ PTSD" must still expose PTSD
  // as a standalone Latin token at this point.
  text = transliterateLatinTokens(text);
  text = expandArabicAbbreviations(text);
  text = text.replace(TATWEEL, "");
  // "الـ X" collapses to a stranded "ال", which is not a word. Reattach it to
  // the following token so the definite article is voiced as an article.
  text = text.replace(/(^|\s)ال\s+(?=[؀-ۿ])/g, "$1ال");
  text = spellArabicNumbers(text);
  text = normalizeArabicPunctuation(text);
  text = applyContextualDiacritics(text);
  text = tidySpeechWhitespace(text);

  return { text, changed: text !== original };
}

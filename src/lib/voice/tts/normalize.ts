/**
 * Text preparation for TTS providers.
 *
 * HARD RULE: this function must never change clinical meaning. It exists only
 * to remove characters that corrupt synthesis or JSON transport. It does not
 * translate, transliterate, summarize, re-word, or pass patient dialogue
 * through a model. The reply produced by the patient agent is the reply that
 * gets spoken.
 *
 * Arabic specifically: no de-diacritization, no alef/hamza folding, no
 * Levantine → MSA rewriting. `ar-JO` personalities are natively authored and
 * their wording is clinical content.
 */

/**
 * Characters that are invisible or directional and can break synthesis or
 * confuse a provider's tokenizer. Note that U+200F/U+200E (RTL/LTR marks) and
 * U+061C (Arabic letter mark) are *display* controls — dropping them cannot
 * change spoken content, only rendering, and TTS does not render.
 */
const CONTROL_AND_FORMATTING =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

export type NormalizeTtsTextResult = {
  text: string;
  /** UTF-8 byte length of the normalized text. */
  bytes: number;
};

/**
 * Normalize whitespace and strip control/formatting characters.
 *
 * - collapses runs of spaces/tabs into a single space
 * - collapses 3+ newlines into a paragraph break (providers read these as pauses)
 * - trims leading/trailing whitespace
 * - removes C0/C1 controls, zero-width and bidi formatting marks
 *
 * Letters, diacritics, punctuation, and word order are left exactly as authored.
 */
export function normalizeTtsText(input: string): NormalizeTtsTextResult {
  const text = input
    .replace(CONTROL_AND_FORMATTING, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]*\n[^\S\n]*/g, "\n")
    .trim();

  return { text, bytes: utf8ByteLength(text) };
}

/**
 * UTF-8 byte length. Arabic is ~2 bytes/char, so a character count is not a
 * safe proxy for any byte-based provider limit.
 */
export function utf8ByteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

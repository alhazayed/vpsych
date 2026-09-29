/**
 * Light sanitization so TTS does not read markup / emoji aloud.
 * Never strips Arabic letters, digits, or deliberate pause punctuation.
 */

/** Common emoji / pictograph ranges. */
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Markdown emphasis / code ticks that TTS may spell out. */
const MARKDOWN_NOISE_RE = /[*_`#]+/g;

/** Bracketed English stage directions: [laughs], (sighs), *crying*. */
const STAGE_DIRECTION_RE =
  /\[\s*(?:laughs?|sighs?|crying|sobbing|whispers?|pause|silence|smiles?|nods?)\s*\]|\(\s*(?:laughs?|sighs?|crying|pause|silence)\s*\)/gi;

export function sanitizeForTts(text: string): string {
  return text
    .replace(STAGE_DIRECTION_RE, "")
    .replace(EMOJI_RE, "")
    .replace(MARKDOWN_NOISE_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

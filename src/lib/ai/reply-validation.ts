/**
 * Patient reply content gate — reject contentless / ellipsis-only output
 * before persistence and before TTS.
 *
 * At most ONE regeneration is the caller's responsibility; this module only
 * classifies text.
 */

export type ReplyValidationResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "punctuation_only" | "ellipsis_only" };

const ARABIC_LETTER = /\p{Script=Arabic}/u;
const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;
const CJK_LETTER = /\p{Script=Han}/u;
/** Digits that can stand alone as a valid short clinical answer ("35.", "٣."). */
const DIGIT = /[0-9\u0660-\u0669]/;

/**
 * Strip common stage-direction wrappers and normalize ellipsis variants.
 */
function normalizeForCheck(raw: string): string {
  return raw
    .replace(/\u2026/g, "…") // unicode ellipsis
    .replace(/\.{3,}/g, "…")
    .replace(/[()[\]{}*_`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLexicalContent(text: string): boolean {
  return (
    ARABIC_LETTER.test(text) ||
    LATIN_LETTER.test(text) ||
    CJK_LETTER.test(text) ||
    DIGIT.test(text)
  );
}

/**
 * True when the string is only punctuation / ellipsis / whitespace after trim.
 * Valid short answers like "آه.", "لا.", "مش كثير.", "يمكن." pass.
 */
export function isContentlessPatientReply(text: string): boolean {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return true;
  const normalized = normalizeForCheck(trimmed);
  if (!normalized) return true;
  if (!hasLexicalContent(normalized)) return true;
  // "يعني… …" has Arabic letters but is an authored-empty stall pattern:
  // letter(s) + only ellipsis/punctuation remainder with no other word.
  // Reject when the only letters form a single filler lemma then ellipsis.
  const withoutEllipsis = normalized.replace(/[….]+/g, " ").trim();
  if (!withoutEllipsis) return true;
  // Single filler word + ellipsis only (يعني… … / يعني…)
  if (/^(يعني|um+|uh+|erm+|hmm+)\s*$/iu.test(withoutEllipsis)) {
    return true;
  }
  return false;
}

export function validatePatientReply(text: string): ReplyValidationResult {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return { ok: false, reason: "empty" };
  const normalized = normalizeForCheck(trimmed);
  if (!normalized) return { ok: false, reason: "empty" };
  if (!hasLexicalContent(normalized)) {
    // Ellipsis-only: unicode … or three-or-more dots (already normalized to …).
    const compact = normalized.replace(/\s+/g, "");
    if (/^[…]+$/.test(compact) || /^\.{3,}$/.test(compact)) {
      return { ok: false, reason: "ellipsis_only" };
    }
    return { ok: false, reason: "punctuation_only" };
  }
  if (isContentlessPatientReply(trimmed)) {
    return { ok: false, reason: "ellipsis_only" };
  }
  return { ok: true };
}

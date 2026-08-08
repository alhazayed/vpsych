/** Arabic script / digit helpers for ASPE. */

const ARABIC_LETTER =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** True when the string contains at least one Arabic letter. */
export function containsArabicScript(text: string): boolean {
  return ARABIC_LETTER.test(text);
}

/** Map Arabic-Indic digits to Western 0–9; leave other chars unchanged. */
export function normalizeIndicDigitChar(ch: string): string {
  const idx = ARABIC_INDIC_DIGITS.indexOf(ch);
  return idx >= 0 ? String(idx) : ch;
}

/** Parse a run of Western or Arabic-Indic digits to a non-negative integer. */
export function parseDigitRun(run: string): number | null {
  if (!run) return null;
  let western = "";
  for (const ch of run) {
    const n = normalizeIndicDigitChar(ch);
    if (!/^\d$/.test(n)) return null;
    western += n;
  }
  if (western.length > 6) return null;
  const n = Number(western);
  return Number.isFinite(n) ? n : null;
}

/** True if the token already carries meaningful tashkeel (fatha…sukun). */
export function hasTashkeel(token: string): boolean {
  return /[\u064B-\u0652]/.test(token);
}

/** Strip common combining marks for dictionary key lookup. */
export function stripTashkeel(token: string): string {
  return token.replace(/[\u064B-\u0652]/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a regex source that matches an undiacritized Arabic key even when the
 * surface carries partial tashkeel / shadda (e.g. الحدّية ≈ الحدية).
 * Non-Arabic characters are matched literally.
 */
export function arabicFlexiblePattern(undiacritized: string): string {
  let out = "";
  for (const ch of undiacritized) {
    if (/[\u0600-\u06FF]/.test(ch)) {
      // Letter, then any number of Arabic combining marks (tashkeel / shadda).
      out += `${escapeRegExp(ch)}[\\u064B-\\u065F\\u0670]*`;
    } else {
      out += escapeRegExp(ch);
    }
  }
  return out;
}

/** True when the surface is already exactly the speech-guided form. */
export function isExactSpeechForm(surface: string, guided: string): boolean {
  return surface === guided;
}

/**
 * Text preparation for TTS — what ElevenLabs is asked to say, not what the
 * transcript shows. The patient reply is persisted untouched; only the copy
 * sent to synthesis is normalized here.
 *
 * Arabic gets the most work: multilingual models often read Western or
 * Arabic-Indic digits with an English (or no) pronunciation inside Arabic
 * speech, and the kashida (tatweel, ـ) used for written emphasis is read as
 * a stretched or broken syllable. Numbers are spelled out as Arabic words and
 * tatweel is removed so the voice stays in one language.
 */

import type { SessionSpeechLocale } from "@/lib/voice/config";

const UNITS = [
  "صفر",
  "واحد",
  "اثنين",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
];

const TEENS = [
  "عشرة",
  "أحد عشر",
  "اثني عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const TENS = [
  "",
  "",
  "عشرين",
  "ثلاثين",
  "أربعين",
  "خمسين",
  "ستين",
  "سبعين",
  "ثمانين",
  "تسعين",
];

const HUNDREDS = [
  "",
  "مئة",
  "مئتين",
  "ثلاثمئة",
  "أربعمئة",
  "خمسمئة",
  "ستمئة",
  "سبعمئة",
  "ثمانمئة",
  "تسعمئة",
];

/** Largest integer spelled out; anything bigger is left as digits. */
const MAX_SPOKEN_INTEGER = 999_999;

function belowHundred(n: number): string {
  if (n < 10) return UNITS[n]!;
  if (n < 20) return TEENS[n - 10]!;
  const unit = n % 10;
  const tens = TENS[Math.floor(n / 10)]!;
  return unit === 0 ? tens : `${UNITS[unit]} و${tens}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return belowHundred(rest);
  if (rest === 0) return HUNDREDS[hundreds]!;
  return `${HUNDREDS[hundreds]} و${belowHundred(rest)}`;
}

function thousandsWord(n: number): string {
  if (n === 1) return "ألف";
  if (n === 2) return "ألفين";
  if (n <= 10) return `${belowHundred(n)} آلاف`;
  return `${belowThousand(n)} ألف`;
}

/**
 * Spell a non-negative integer as spoken Arabic (masculine counting form).
 * Returns null above {@link MAX_SPOKEN_INTEGER} so callers keep the digits.
 */
export function arabicNumberWords(n: number): string | null {
  if (!Number.isInteger(n) || n < 0 || n > MAX_SPOKEN_INTEGER) return null;
  if (n < 1000) return belowThousand(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousandsWord(thousands);
  return rest === 0 ? head : `${head} و${belowThousand(rest)}`;
}

/** Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits → ASCII. */
function toAsciiDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const DIGIT = "[0-9\\u0660-\\u0669\\u06F0-\\u06F9]";
/**
 * A number not glued to Latin letters (so "COVID19" or "B12" keep their
 * digits), with optional thousands separators, an optional decimal part and
 * an optional percent sign.
 */
const NUMBER_RE = new RegExp(
  `(?<![A-Za-z0-9\\u0660-\\u0669\\u06F0-\\u06F9])(${DIGIT}{1,3}(?:[,\\u066C]${DIGIT}{3})+|${DIGIT}+)(?:[.\\u066B](${DIGIT}+))?(?:\\s?([%\\u066A]))?(?![A-Za-z0-9\\u0660-\\u0669\\u06F0-\\u06F9])`,
  "g",
);

function spellArabicNumbers(text: string): string {
  return text.replace(
    NUMBER_RE,
    (match, whole: string, fraction: string | undefined, percent: string | undefined) => {
      const wholeWords = arabicNumberWords(
        Number(toAsciiDigits(whole).replace(/[,\u066C]/g, "")),
      );
      if (wholeWords === null) return match;
      let spoken = wholeWords;
      if (fraction) {
        // Read the decimal part digit by digit, the way people say "2.05".
        const digits = toAsciiDigits(fraction)
          .split("")
          .map((d) => UNITS[Number(d)]!)
          .join(" ");
        spoken = `${spoken} فاصلة ${digits}`;
      }
      if (percent) spoken = `${spoken} بالمئة`;
      return spoken;
    },
  );
}

/** Kashida / tatweel: typographic stretching, never pronounced. */
const TATWEEL_RE = /ـ/g;

/**
 * Narration the patient prompt forbids but a model can still emit:
 * *sighs*, [pause]. Read aloud they break the illusion of a person talking.
 */
const STAGE_DIRECTION_RE = /\*[^*\n]{1,60}\*|\[[^\]\n]{1,60}\]/g;

/** Emoji and pictographs: ElevenLabs either skips them or reads their names. */
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/**
 * Trailing-off pauses written as "…" or "...". ElevenLabs renders each one as
 * a long silence, so a slow-paced patient (depression) whose reply is full of
 * them sounds dragged out rather than low-energy. The text keeps the clinical
 * signal; the audio keeps at most this many real pauses per request and the
 * rest become ordinary comma breaths.
 */
export const MAX_SPOKEN_PAUSES = 2;

const ELLIPSIS_RUN_RE = /(?:\s*(?:\.\s*){2,}\.|\s*…+)+/g;

function limitSpokenPauses(text: string, locale: SessionSpeechLocale): string {
  const comma = locale === "ar" ? "،" : ",";
  // A reply that opens on "…" would start with dead air.
  const trimmed = text.replace(/^(?:\s*(?:\.\s*){2,}\.|\s*…+)+\s*/, "");
  let kept = 0;
  return trimmed.replace(ELLIPSIS_RUN_RE, (_run, offset: number, whole: string) => {
    const atEnd = whole.slice(offset + _run.length).trim() === "";
    if (kept < MAX_SPOKEN_PAUSES) {
      kept += 1;
      return "…";
    }
    return atEnd ? "." : `${comma} `;
  });
}

/**
 * Prepare a patient reply for speech synthesis.
 *
 * - every locale: drop *stage directions*, [bracketed cues], leftover
 *   markdown emphasis and emoji; keep at most {@link MAX_SPOKEN_PAUSES}
 *   "…" pauses; collapse whitespace.
 * - Arabic: remove tatweel and spell numbers as Arabic words.
 *
 * If cleaning would leave nothing to say, the trimmed original is returned so
 * a turn never loses its audio to the cleaner.
 */
export function prepareTextForSpeech(
  text: string,
  locale: SessionSpeechLocale,
): string {
  const original = text.trim();
  let out = original
    // **bold** / __bold__ is emphasis on spoken words: keep the words.
    .replace(/(\*\*|__)([^*_\n]+?)\1/g, "$2")
    .replace(STAGE_DIRECTION_RE, " ")
    .replace(EMOJI_RE, "")
    .replace(/[*_]{1,3}/g, "");

  if (locale === "ar") {
    out = out.replace(TATWEEL_RE, "");
    out = spellArabicNumbers(out);
  }

  out = limitSpokenPauses(out, locale);

  out = out
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/ +([.,!?،؟؛:])/g, "$1")
    .trim();

  return out || original;
}

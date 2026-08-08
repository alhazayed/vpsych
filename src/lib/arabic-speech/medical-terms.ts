/**
 * Selective clinical / ambiguous-word tashkeel for Arabic TTS.
 * Longest phrases first. Only applied when the surface form lacks tashkeel.
 */

import { hasTashkeel, stripTashkeel } from "./detect";

/**
 * Professional Arabic clinical pronunciations (selective diacritics).
 * Keys are undiacritized surface forms; values are TTS-preferred forms.
 */
export const CLINICAL_TASHKEEL_LEXICON: ReadonlyArray<
  readonly [string, string]
> = [
  // Multi-word phrases (longest first)
  ["اضطراب ثنائي القطب", "اضطراب ثُنَائِيِّ القُطْب"],
  ["الاضطراب ثنائي القطب", "الاضطراب ثُنَائِيِّ القُطْب"],
  ["ثنائي القطب", "ثُنَائِيِّ القُطْب"],
  ["الوسواس القهري", "الوَسْوَاس القَهْرِي"],
  ["وسواس قهري", "وَسْوَاس قَهْرِي"],
  ["ما بعد الصدمة", "ما بَعْد الصَّدْمَة"],
  ["فرط الحركة", "فَرْط الحَرَكَة"],
  ["تشتت الانتباه", "تَشَتُّت الانتباه"],
  ["نوبات الهلع", "نَوَبات الهَلَع"],
  ["نوبة هلع", "نَوْبة هَلَع"],
  ["إيذاء النفس", "إيذاء النَّفْس"],
  ["الأفكار الانتحارية", "الأفكار الانْتِحارِيَّة"],
  ["أفكار انتحارية", "أفكار انْتِحارِيَّة"],

  // Single clinical terms
  ["الفصام", "الفُصَام"],
  ["فصام", "فُصَام"],
  ["الذهان", "الذُّهَان"],
  ["ذهان", "ذُهَان"],
  ["الهلوسة", "الهَلْوَسَة"],
  ["هلوسة", "هَلْوَسَة"],
  ["الهلوسات", "الهَلْوَسات"],
  ["هلوسات", "هَلْوَسات"],
  ["الانتحار", "الانْتِحار"],
  ["انتحار", "انْتِحار"],
  ["الوسواس", "الوَسْوَاس"],
  ["وسواس", "وَسْوَاس"],
  ["القلق", "القَلَق"],
  ["قلق", "قَلَق"],
  ["الاكتئاب", "الاكتِئاب"],
  ["اكتئاب", "اكتِئاب"],
  ["الهوس", "الهَوَس"],
  ["هوس", "هَوَس"],
  ["الذهاني", "الذُّهانِي"],
  ["ذهاني", "ذُهانِي"],
  ["البارانويا", "البارانُويا"],
  ["بارانويا", "بارانُويا"],
  ["الضلالات", "الضَّلالات"],
  ["ضلالات", "ضَلالات"],
  ["الهذيان", "الهَذَيان"],
  ["هذيان", "هَذَيان"],
  ["الأرق", "الأَرَق"],
  ["أرق", "أَرَق"],
  ["الانهيار", "الانْهِيار"],
  ["انهيار", "انْهِيار"],
  ["التعاطي", "التَّعاطي"],
  ["تعاطي", "تَعاطي"],
  ["الانسحاب", "الانْسِحاب"],
  ["انسحاب", "انْسِحاب"],
];

/** Common given names that TTS often mis-vowelizes. */
export const NAME_TASHKEEL_LEXICON: ReadonlyArray<readonly [string, string]> = [
  ["ليان", "لِيان"],
  ["رامي", "رامِي"],
  ["نصار", "نَصّار"],
  ["خوري", "خُورِي"],
  ["فادي", "فادِي"],
  ["نبيل", "نَبِيل"],
  ["هيام", "هِيام"],
  ["نتالي", "نَتالِي"],
  ["وديعة", "وَدِيعة"],
];

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
  return applyLexicon(text, CLINICAL_TASHKEEL_LEXICON);
}

export function applyNameTashkeel(text: string): string {
  return applyLexicon(text, NAME_TASHKEEL_LEXICON);
}

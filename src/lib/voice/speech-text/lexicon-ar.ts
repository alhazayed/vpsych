/**
 * Minimal deterministic Arabic pronunciation lexicon.
 *
 * Deliberately small. This is NOT a general Arabic pronunciation dictionary and
 * must not grow into one without evidence. Every entry here exists because a
 * specific token in the development corpus is mispronounced when handed to the
 * TTS provider as-is.
 *
 * Scope rules (enforced by lexicon-ar.test.ts):
 * - Never maps a Jordanian/Levantine colloquial word onto an MSA equivalent.
 * - Never changes meaning, register, or vocabulary.
 * - Only fixes HOW an existing token is voiced.
 *
 * On `voice_profiles.pronunciation_ar` / `pronunciation_en`:
 * those columns contain free prose ("Levantine Arabic; soft consonants;
 * measured cadence"), not machine-usable pronunciation rules. They are
 * therefore treated as NON-OPERATIONAL — see NON_OPERATIONAL_PRONUNCIATION_NOTE
 * below. No parser is invented for them.
 */

export const NON_OPERATIONAL_PRONUNCIATION_NOTE =
  "voice_profiles.pronunciation_ar / pronunciation_en hold descriptive prose, " +
  "not machine-usable pronunciation rules. They are not consumed at synthesis " +
  "time. Deterministic pronunciation lives in lexicon-ar.ts instead.";

/**
 * Latin-script tokens that appear inside Arabic clinical speech and are voiced
 * with English phonology unless transliterated. Medication brand names,
 * psychiatric acronyms, and a few unavoidable loanwords.
 *
 * Keys are matched case-insensitively on whole words only.
 */
export const AR_LATIN_TRANSLITERATIONS: Record<string, string> = {
  // Medications commonly named in psychiatric interviews.
  prozac: "بروزاك",
  fluoxetine: "فلوكسيتين",
  zoloft: "زولوفت",
  sertraline: "سيرترالين",
  xanax: "زاناكس",
  alprazolam: "ألبرازولام",
  lexapro: "ليكسابرو",
  escitalopram: "إيسيتالوبرام",
  cipralex: "سيبرالكس",
  lithium: "ليثيوم",
  risperdal: "ريسبيردال",
  risperidone: "ريسبيريدون",
  olanzapine: "أولانزابين",
  quetiapine: "كويتيابين",
  seroquel: "سيروكويل",
  diazepam: "ديازيبام",
  valium: "فاليوم",
  // Psychiatric / clinical acronyms — spelled out in Arabic letter names.
  ssri: "إس إس آر آي",
  snri: "إس إن آر آي",
  ocd: "أو سي دي",
  ptsd: "بي تي إس دي",
  adhd: "إيه دي إتش دي",
  cbt: "سي بي تي",
  ecg: "إي سي جي",
  mri: "إم آر آي",
  // Everyday loanwords that genuinely occur in Jordanian speech.
  whatsapp: "واتساب",
  online: "أونلاين",
};

/**
 * Arabic abbreviations that are read as letters unless expanded.
 * Matched as whole tokens.
 */
export const AR_ABBREVIATIONS: Record<string, string> = {
  "د.": "دكتور",
  "أ.د.": "أستاذ دكتور",
  مغ: "ميليغرام",
  ملغ: "ميليغرام",
  "مل.": "ميليلتر",
  "ص.": "صباحاً",
  "م.": "مساءً",
};

/**
 * Cardinal numbers in citation form. Used only for 0–10 and round tens, where
 * the citation form is unambiguous. Anything outside this table is left as
 * Western digits rather than risking wrong gender agreement — see
 * ARABIC_NUMERAL_LIMITATION.
 */
export const AR_CARDINALS: Record<number, string> = {
  0: "صفر",
  1: "واحد",
  2: "اثنين",
  3: "ثلاثة",
  4: "أربعة",
  5: "خمسة",
  6: "ستة",
  7: "سبعة",
  8: "ثمانية",
  9: "تسعة",
  10: "عشرة",
  20: "عشرين",
  30: "ثلاثين",
  40: "أربعين",
  50: "خمسين",
  60: "ستين",
  70: "سبعين",
  80: "ثمانين",
  90: "تسعين",
  100: "مية",
  1000: "ألف",
};

export const ARABIC_NUMERAL_LIMITATION =
  "Arabic cardinal gender agreement (ثلاثة/ثلاث) depends on the counted noun, " +
  "which this layer does not parse. Only unambiguous citation forms are " +
  "spelled out; every other number is emitted as Western digits.";

/**
 * Contextual pronunciation repairs — restore gemination (shadda) that the model
 * frequently omits in Levantine spelling. These do NOT change the word, the
 * dialect, or the register; they only make the existing Jordanian word be
 * voiced correctly instead of as a different, wrong reading.
 *
 * This is the ONLY diacritic handling in the pipeline. There is no blanket
 * diacritization anywhere.
 */
export const AR_CONTEXTUAL_DIACRITICS: Record<string, string> = {
  بدي: "بدّي",
  بديش: "بدّيش",
  هسه: "هسّه",
  هلق: "هلّق",
};

/**
 * Jordanian/Levantine vocabulary that must survive the speech layer untouched.
 * Asserted by tests — this list is a guard against MSA sterilization.
 */
export const AR_PROTECTED_COLLOQUIAL = [
  "شو",
  "ليش",
  "كتير",
  "مش",
  "بدّي",
  "هسّه",
  "يعني",
  "طيب",
  "بصراحة",
  "منيح",
  "زلمة",
  "هيك",
  "لسا",
] as const;

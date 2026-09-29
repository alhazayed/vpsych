/**
 * Versioned medical / psychiatric speech dictionary for ASPE.
 *
 * canonical Arabic (or Latin abbrev surface) → speech-safe Arabic form.
 * Deterministic, version-controlled, isolated from clinical case data.
 *
 * Do NOT use this for dialect rewriting or clinical content invention.
 */

export const MEDICAL_SPEECH_DICTIONARY_VERSION = "1.0.0" as const;

export type MedicalSpeechEntry = {
  /** Undiacritized / canonical surface matched in dialogue. */
  canonical: string;
  /** Selective-tashkeel (or expanded) form for TTS. */
  speech: string;
  /** Category for docs / tests. */
  category:
    | "disorder"
    | "symptom"
    | "process"
    | "medication"
    | "phrase";
};

/**
 * High-value psychiatric / medical terms.
 * Longest phrases first within each group; applyLexicon sorts by length.
 */
export const MEDICAL_SPEECH_DICTIONARY: readonly MedicalSpeechEntry[] = [
  // Phrases / disorders
  {
    canonical: "اضطراب الشخصية الحدية",
    speech: "اضطراب الشخصية الحَدِّيَّة",
    category: "disorder",
  },
  {
    canonical: "اضطراب الشخصية الحدّية",
    speech: "اضطراب الشخصية الحَدِّيَّة",
    category: "disorder",
  },
  {
    canonical: "اضطراب ثنائي القطب",
    speech: "اضطراب ثُنَائِيِّ القُطْب",
    category: "disorder",
  },
  {
    canonical: "الاضطراب ثنائي القطب",
    speech: "الاضطراب ثُنَائِيِّ القُطْب",
    category: "disorder",
  },
  {
    canonical: "ثنائي القطب",
    speech: "ثُنَائِيِّ القُطْب",
    category: "disorder",
  },
  {
    canonical: "الوسواس القهري",
    speech: "الوَسْوَاس القَهْرِي",
    category: "disorder",
  },
  {
    canonical: "وسواس قهري",
    speech: "وَسْوَاس قَهْرِي",
    category: "disorder",
  },
  {
    canonical: "اضطراب ما بعد الصدمة",
    speech: "اضطراب ما بَعْد الصَّدْمَة",
    category: "disorder",
  },
  {
    canonical: "ما بعد الصدمة",
    speech: "ما بَعْد الصَّدْمَة",
    category: "phrase",
  },
  {
    canonical: "فرط الحركة",
    speech: "فَرْط الحَرَكَة",
    category: "symptom",
  },
  {
    canonical: "تشتت الانتباه",
    speech: "تَشَتُّت الانتباه",
    category: "symptom",
  },
  {
    canonical: "نوبات الهلع",
    speech: "نَوَبات الهَلَع",
    category: "symptom",
  },
  {
    canonical: "نوبة هلع",
    speech: "نَوْبة هَلَع",
    category: "symptom",
  },
  {
    canonical: "إيذاء النفس",
    speech: "إيذاء النَّفْس",
    category: "process",
  },
  {
    canonical: "الأفكار الانتحارية",
    speech: "الأفكار الانْتِحارِيَّة",
    category: "symptom",
  },
  {
    canonical: "أفكار انتحارية",
    speech: "أفكار انْتِحارِيَّة",
    category: "symptom",
  },

  // Single terms
  { canonical: "الفصام", speech: "الفُصَام", category: "disorder" },
  { canonical: "فصام", speech: "فُصَام", category: "disorder" },
  { canonical: "الذهان", speech: "الذُّهَان", category: "disorder" },
  { canonical: "ذهان", speech: "ذُهَان", category: "disorder" },
  { canonical: "الهلوسة", speech: "الهَلْوَسَة", category: "symptom" },
  { canonical: "هلوسة", speech: "هَلْوَسَة", category: "symptom" },
  { canonical: "الهلوسات", speech: "الهَلْوَسات", category: "symptom" },
  { canonical: "هلوسات", speech: "هَلْوَسات", category: "symptom" },
  { canonical: "الانتحار", speech: "الانْتِحار", category: "process" },
  { canonical: "انتحار", speech: "انْتِحار", category: "process" },
  { canonical: "الوسواس", speech: "الوَسْوَاس", category: "disorder" },
  { canonical: "وسواس", speech: "وَسْوَاس", category: "disorder" },
  { canonical: "القلق", speech: "القَلَق", category: "symptom" },
  { canonical: "قلق", speech: "قَلَق", category: "symptom" },
  { canonical: "الاكتئاب", speech: "الاكتِئاب", category: "disorder" },
  { canonical: "اكتئاب", speech: "اكتِئاب", category: "disorder" },
  { canonical: "الهوس", speech: "الهَوَس", category: "symptom" },
  { canonical: "هوس", speech: "هَوَس", category: "symptom" },
  { canonical: "الذهاني", speech: "الذُّهانِي", category: "symptom" },
  { canonical: "ذهاني", speech: "ذُهانِي", category: "symptom" },
  { canonical: "البارانويا", speech: "البارانُويا", category: "symptom" },
  { canonical: "بارانويا", speech: "بارانُويا", category: "symptom" },
  { canonical: "الضلالات", speech: "الضَّلالات", category: "symptom" },
  { canonical: "ضلالات", speech: "ضَلالات", category: "symptom" },
  { canonical: "الهذيان", speech: "الهَذَيان", category: "symptom" },
  { canonical: "هذيان", speech: "هَذَيان", category: "symptom" },
  { canonical: "الأرق", speech: "الأَرَق", category: "symptom" },
  { canonical: "أرق", speech: "أَرَق", category: "symptom" },
  { canonical: "الانهيار", speech: "الانْهِيار", category: "process" },
  { canonical: "انهيار", speech: "انْهِيار", category: "process" },
  { canonical: "التعاطي", speech: "التَّعاطي", category: "process" },
  { canonical: "تعاطي", speech: "تَعاطي", category: "process" },
  { canonical: "الانسحاب", speech: "الانْسِحاب", category: "process" },
  { canonical: "انسحاب", speech: "انْسِحاب", category: "process" },

  // Common psychiatric medications — Latin → Arabic TTS-safe spelling
  { canonical: "Sertraline", speech: "سيرترالين", category: "medication" },
  { canonical: "Fluoxetine", speech: "فلوكسيتين", category: "medication" },
  {
    canonical: "Escitalopram",
    speech: "إسيتالوبرام",
    category: "medication",
  },
  { canonical: "Venlafaxine", speech: "فينلافاكسين", category: "medication" },
  { canonical: "Quetiapine", speech: "كيتيابين", category: "medication" },
  { canonical: "Risperidone", speech: "ريسبيريدون", category: "medication" },
  { canonical: "Olanzapine", speech: "أولانزابين", category: "medication" },
  { canonical: "Lithium", speech: "ليثيوم", category: "medication" },
  { canonical: "Lorazepam", speech: "لورازيبام", category: "medication" },
  { canonical: "Alprazolam", speech: "ألپرازولام", category: "medication" },
  { canonical: "Prozac", speech: "بروزاك", category: "medication" },
  { canonical: "Zoloft", speech: "زولوفت", category: "medication" },
] as const;

/** Lexicon pairs for applyLexicon / analyze (longest-first). */
export function medicalDictionaryLexicon(): ReadonlyArray<
  readonly [string, string]
> {
  return [...MEDICAL_SPEECH_DICTIONARY]
    .map((e) => [e.canonical, e.speech] as const)
    .sort((a, b) => b[0].length - a[0].length);
}

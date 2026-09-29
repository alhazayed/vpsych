/**
 * Deterministic Arabic pronunciation regression corpus for ASPE.
 * Text-level expectations are asserted in unit tests.
 * Spoken audio QA uses the same cases via scripts/aspe-listening-qa.mjs
 * (Original ElevenLabs vs ASPE-prepared ElevenLabs).
 */

export type CorpusCase = {
  id: string;
  group:
    | "general"
    | "psychiatric"
    | "patient"
    | "levantine"
    | "numbers"
    | "names"
    | "safety"
    | "abbreviations";
  input: string;
  /** Substrings that MUST appear after prepare (speech surface). */
  mustInclude?: string[];
  /** Substrings that must NOT appear (no MSA rewrite / no invention). */
  mustNotInclude?: string[];
  /** When set, exact equality after prepare. */
  exact?: string;
  /** Expect unchanged (English / no-op). */
  unchanged?: boolean;
  /** Include in live ElevenLabs listening batches (default true for speech cases). */
  listen?: boolean;
};

export const ASPE_PRONUNCIATION_CORPUS: readonly CorpusCase[] = [
  // A. General Arabic — conversational, ambiguous, common phrases
  {
    id: "gen-hello",
    group: "general",
    input: "مرحبا، كيف حالك اليوم؟",
    mustInclude: ["مرحبا", "كيف حالك"],
  },
  {
    id: "gen-ambiguous-qalaq",
    group: "general",
    input: "القلق بخوفني بالليل",
    mustInclude: ["القَلَق"],
  },
  {
    id: "gen-ambiguous-waswas",
    group: "general",
    input: "الوسواس بخلّيني أشك بكل إشي",
    mustInclude: ["الوَسْوَاس"],
  },
  {
    id: "gen-verb-qala",
    group: "general",
    input: "قالت لي إنه الوضع صعب، وما بقدر أنام",
    mustInclude: ["قالت لي", "ما بقدر أنام"],
    mustNotInclude: ["قالتْ لِيْ إِنَّهُ"],
  },
  {
    id: "gen-common-phrase",
    group: "general",
    input: "والله ما بقدر أكمل هيك، تعبانة كتير",
    mustInclude: ["والله ما بقدر أكمل", "تعبانة كتير"],
  },
  {
    id: "gen-percent",
    group: "numbers",
    input: "نزل دخلي حوالي 10%",
    mustInclude: ["عشرة بالمئة"],
  },
  {
    id: "gen-clock",
    group: "numbers",
    input: "بستيقظ الساعة 3",
    mustInclude: ["الساعة الثالثة"],
  },
  {
    id: "gen-clock-morning",
    group: "numbers",
    input: "بصحى الساعة 7 وبخاف",
    mustInclude: ["الساعة السابعة"],
  },
  {
    id: "gen-dose",
    group: "numbers",
    input: "الجرعة 25 ملغ كل يوم",
    mustInclude: ["خمسة وعشرون ملغ"],
  },
  {
    id: "gen-half-dose",
    group: "numbers",
    input: "باخذ 1.5 ملغ",
    mustInclude: ["واحد ونصف ملغ"],
  },
  {
    id: "gen-days",
    group: "numbers",
    input: "صار لي 3 أيام ما نمت",
    mustInclude: ["ثلاثة أيام"],
  },
  {
    id: "gen-twice",
    group: "numbers",
    input: "بروح العيادة 2 مرات بالأسبوع",
    mustInclude: ["مرتين"],
  },
  {
    id: "gen-twenty-one",
    group: "numbers",
    input: "عندي موعد بعد 21 يوم",
    mustInclude: ["واحد وعشرون يوم"],
  },
  {
    id: "gen-hundred",
    group: "numbers",
    input: "الجرعة صارت 100 ملغ",
    mustInclude: ["مئة ملغ"],
  },
  {
    id: "gen-age",
    group: "numbers",
    input: "عمري 28 سنة وهيك من زمان",
    mustInclude: ["ثماني وعشرون سنة"],
  },
  {
    id: "gen-duration-weeks",
    group: "numbers",
    input: "صار لي 6 أسابيع على الدوا",
    mustInclude: ["ستة أسابيع"],
  },
  {
    id: "gen-year-bare",
    group: "numbers",
    input: "من ٢٠٢٥ وأنا هيك",
    exact: "من ٢٠٢٥ وأنا هيك",
  },

  // B. Psychiatric terminology (canonical list)
  {
    id: "psy-depression",
    group: "psychiatric",
    input: "بحس بالاكتئاب كل يوم",
    mustInclude: ["الاكتِئاب"],
  },
  {
    id: "psy-anxiety",
    group: "psychiatric",
    input: "القلق ما بيروح",
    mustInclude: ["القَلَق"],
  },
  {
    id: "psy-ocd-ar",
    group: "psychiatric",
    input: "الوسواس القهري متعبني",
    mustInclude: ["الوَسْوَاس القَهْرِي"],
  },
  {
    id: "psy-bipolar",
    group: "psychiatric",
    input: "قالوا اضطراب ثنائي القطب",
    mustInclude: ["ثُنَائِيِّ القُطْب"],
  },
  {
    id: "psy-schizophrenia",
    group: "psychiatric",
    input: "الفصام مو سهل",
    mustInclude: ["الفُصَام"],
  },
  {
    id: "psy-psychosis",
    group: "psychiatric",
    input: "الذهان والهلوسة",
    mustInclude: ["الذُّهَان", "الهَلْوَسَة"],
  },
  {
    id: "psy-panic",
    group: "psychiatric",
    input: "بتجي نوبات الهلع فجأة",
    mustInclude: ["نَوَبات الهَلَع"],
  },
  {
    id: "psy-ptsd-ar",
    group: "psychiatric",
    input: "عندي اضطراب ما بعد الصدمة",
    mustInclude: ["ما بَعْد الصَّدْمَة"],
  },
  {
    id: "psy-bpd-ar",
    group: "psychiatric",
    input: "تشخيص اضطراب الشخصية الحدية",
    mustInclude: ["الحَدِّيَّة"],
  },
  {
    id: "psy-bpd-shadda",
    group: "psychiatric",
    input: "عندي اضطراب الشخصية الحدّية",
    mustInclude: ["الحَدِّيَّة"],
  },
  {
    id: "psy-med-sertraline",
    group: "psychiatric",
    input: "باخذ Sertraline من شهرين",
    mustInclude: ["سيرترالين"],
  },

  // C. Abbreviations (Latin → spoken Arabic)
  {
    id: "abbr-adhd",
    group: "abbreviations",
    input: "عندي ADHD من زمان",
    mustInclude: ["اضطراب فرط الحركة وتشتت الانتباه"],
  },
  {
    id: "abbr-ocd",
    group: "abbreviations",
    input: "الـ OCD بسيطر عليّ",
    mustInclude: ["الوَسْوَاس القَهْرِي"],
  },
  {
    id: "abbr-ptsd",
    group: "abbreviations",
    input: "بعد الحادث صار PTSD",
    mustInclude: ["اضطراب ما بعد الصدمة"],
  },
  {
    id: "abbr-bpd",
    group: "abbreviations",
    input: "حكوا إنه BPD",
    mustInclude: ["اضطراب الشخصية الحَدِّيَّة"],
  },
  {
    id: "abbr-gad",
    group: "abbreviations",
    input: "عندي GAD من سنين",
    mustInclude: ["اضطراب القلق العام"],
  },
  {
    id: "abbr-mdd",
    group: "abbreviations",
    input: "التشخيص كان MDD",
    mustInclude: ["اضطراب الاكتئاب الجسيم"],
  },
  {
    id: "abbr-cbt-dbt",
    group: "abbreviations",
    input: "جربت CBT و DBT",
    mustInclude: ["العلاج المعرفي السلوكي", "العلاج الجدلي السلوكي"],
  },

  // D. Patient dialogue (affect preserved — no cheerful rewrite)
  {
    id: "pat-anxious",
    group: "patient",
    input: "قلبي يدق بسرعة وبخاف إني أموت، القلق ما بيخلص",
    mustInclude: ["قلبي يدق", "القَلَق"],
    mustNotInclude: ["بخير", "الحمد لله كل شيء تمام"],
  },
  {
    id: "pat-depressed",
    group: "patient",
    input: "تعبانة، ما في طاقة، والاكتئاب تقيل عليّ",
    mustInclude: ["تعبانة", "الاكتِئاب"],
  },
  {
    id: "pat-psychotic",
    group: "patient",
    input: "بسمع أصوات، والهلوسة بتخوفني",
    mustInclude: ["بسمع أصوات", "الهَلْوَسَة"],
  },
  {
    id: "pat-ocd",
    group: "patient",
    input: "بغسل إيدي عشر مرات من الوسواس القهري",
    mustInclude: ["الوَسْوَاس القَهْرِي"],
  },
  {
    id: "pat-trauma",
    group: "patient",
    input: "كل ما تذكرت الحادث برجع اضطراب ما بعد الصدمة",
    mustInclude: ["ما بَعْد الصَّدْمَة"],
  },
  {
    id: "pat-bipolar",
    group: "patient",
    input: "أيام بكون طاير، وأيام بانهار، قالوا اضطراب ثنائي القطب",
    mustInclude: ["بكون طاير", "ثُنَائِيِّ القُطْب"],
    mustNotInclude: ["أشعر بالسعادة دائما"],
  },
  {
    id: "pat-adolescent",
    group: "patient",
    input: "مش عارفة شو صار فيّي، القلق بالمدرسة كتير",
    mustInclude: ["مش عارفة", "القَلَق"],
    mustNotInclude: ["لا أعرف ما الذي حدث"],
  },

  // E. Levantine / Jordanian — must not MSA-rewrite colloquial speech
  {
    id: "lev-amman",
    group: "levantine",
    input: "والله تعبانة، ما بعرف شو بدي أحكي. بنام عشر ساعات.",
    mustInclude: ["والله تعبانة", "ما بعرف شو بدي أحكي"],
    mustNotInclude: ["لا أعرف ماذا أريد أن أقول"],
  },
  {
    id: "lev-irbid",
    group: "levantine",
    input: "يا زلمة الوضع صعب، القلق بليل بيشتد",
    mustInclude: ["يا زلمة", "القَلَق"],
  },
  {
    id: "lev-code-switch",
    group: "levantine",
    input: "عندي ديدلاين بكرة والقلق مش طبيعي",
    mustInclude: ["ديدلاين", "القَلَق"],
  },
  {
    id: "lev-natural-chat",
    group: "levantine",
    input: "شو بدي أعمل؟ ما بتحمل الضغط، وبصير أرجف",
    mustInclude: ["شو بدي أعمل", "ما بتحمل", "وبصير أرجف"],
    mustNotInclude: ["ماذا يجب أن أفعل", "لا أتحمل"],
  },

  // Names / safety
  {
    id: "name-known",
    group: "names",
    input: "أنا ليان خوري",
    mustInclude: ["لِيان", "خُورِي"],
  },
  {
    id: "name-unknown-unchanged",
    group: "names",
    input: "أنا سامي من الزرقاء",
    exact: "أنا سامي من الزرقاء",
  },
  {
    id: "name-runtime-override",
    group: "names",
    input: "اسمي سامي",
    // exercised in tests with speechNameOverrides
    mustInclude: ["اسمي"],
    listen: false,
  },
  {
    id: "safe-no-invent",
    group: "safety",
    input: "بفكر أحياناً إني تعبانة.",
    mustNotInclude: ["اكتئاب", "تشخيص", "اضطراب"],
  },
  {
    id: "safe-english",
    group: "safety",
    input: "I feel anxious today.",
    unchanged: true,
    listen: false,
  },
  {
    id: "safe-empty",
    group: "safety",
    input: "",
    unchanged: true,
    listen: false,
  },
  {
    id: "safe-already-diacritized",
    group: "safety",
    input: "القَلَق موجود",
    exact: "القَلَق موجود",
  },
] as const;

/** Cases intended for live ElevenLabs A/B listening (skips empty/English-only). */
export function aspeListeningCorpus(): readonly CorpusCase[] {
  return ASPE_PRONUNCIATION_CORPUS.filter((c) => {
    if (c.listen === false) return false;
    if (!c.input.trim()) return false;
    if (c.unchanged && !/[\u0600-\u06FF]/.test(c.input)) return false;
    return true;
  });
}

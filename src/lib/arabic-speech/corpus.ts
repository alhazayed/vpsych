/**
 * Deterministic Arabic pronunciation regression corpus for ASPE.
 * Text-level expectations only — spoken audio QA is EVIDENCE PENDING
 * until ElevenLabs playback is validated in a configured environment.
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
    | "safety";
  input: string;
  /** Substrings that MUST appear after prepare (speech surface). */
  mustInclude?: string[];
  /** Substrings that must NOT appear (no MSA rewrite / no invention). */
  mustNotInclude?: string[];
  /** When set, exact equality after prepare. */
  exact?: string;
  /** Expect unchanged (English / no-op). */
  unchanged?: boolean;
};

export const ASPE_PRONUNCIATION_CORPUS: readonly CorpusCase[] = [
  // A. General
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
    id: "gen-year-bare",
    group: "numbers",
    input: "من ٢٠٢٥ وأنا هيك",
    exact: "من ٢٠٢٥ وأنا هيك",
  },

  // B. Psychiatric terminology
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
    id: "psy-adhd",
    group: "psychiatric",
    input: "عندي ADHD من زمان",
    mustInclude: ["اضطراب فرط الحركة وتشتت الانتباه"],
  },
  {
    id: "psy-ocd-en",
    group: "psychiatric",
    input: "الـ OCD بسيطر عليّ",
    mustInclude: ["الوَسْوَاس القَهْرِي"],
  },
  {
    id: "psy-ptsd-en",
    group: "psychiatric",
    input: "بعد الحادث صار PTSD",
    mustInclude: ["اضطراب ما بعد الصدمة"],
  },
  {
    id: "psy-med-sertraline",
    group: "psychiatric",
    input: "باخذ Sertraline من شهرين",
    mustInclude: ["سيرترالين"],
  },

  // C. Patient dialogue (affect preserved — no cheerful rewrite)
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
    id: "pat-adolescent",
    group: "patient",
    input: "مش عارفة شو صار فيّي، القلق بالمدرسة كتير",
    mustInclude: ["مش عارفة", "القَلَق"],
    mustNotInclude: ["لا أعرف ما الذي حدث"],
  },

  // D. Levantine / Jordanian
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
  },
  {
    id: "safe-empty",
    group: "safety",
    input: "",
    unchanged: true,
  },
  {
    id: "safe-already-diacritized",
    group: "safety",
    input: "القَلَق موجود",
    exact: "القَلَق موجود",
  },
] as const;

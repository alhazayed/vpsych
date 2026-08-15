/**
 * DEVELOPMENT-ONLY speech evaluation corpus.
 *
 * These are synthetic test sentences for exercising the speech-text layer and
 * for human listening comparisons. They are NOT clinical data.
 *
 * HARD RULE: nothing in this file may be written into `personas/`, `avatars`,
 * `sessions`, `session_messages`, `clinical_snapshot`, or any other production
 * table. It is imported by tests only; `speech-text.test.ts` asserts that no
 * production module imports it. The manual listening procedure that uses these
 * sentences is documented in `docs/VOICE_SPEECH_EVALUATION.md`.
 */

export type CorpusEntry = {
  id: string;
  locale: "ar" | "en";
  text: string;
  /** What this entry is meant to exercise. */
  probes: string[];
};

/** 10 Jordanian conversational sentences. */
export const AR_CONVERSATIONAL: CorpusEntry[] = [
  { id: "ar-conv-01", locale: "ar", text: "من فترة وأنا بحس بخوف بدون سبب واضح.", probes: ["baseline"] },
  { id: "ar-conv-02", locale: "ar", text: "لما أكون بين الناس، بحس إنه الكل عم يطلع علي.", probes: ["comma", "clause"] },
  { id: "ar-conv-03", locale: "ar", text: "أحياناً بيجيني خفقان وبحس إني رح أموت.", probes: ["conjunction"] },
  { id: "ar-conv-04", locale: "ar", text: "أنا مش متأكد إذا اللي بحسه طبيعي.", probes: ["negation", "مش"] },
  { id: "ar-conv-05", locale: "ar", text: "يعني... ما بعرف كيف أشرحها.", probes: ["hesitation", "ellipsis"] },
  { id: "ar-conv-06", locale: "ar", text: "صرت أتجنب الأماكن اللي فيها ناس كثير.", probes: ["baseline"] },
  { id: "ar-conv-07", locale: "ar", text: "شو بدي أحكي؟ ما في إشي جديد.", probes: ["question", "شو", "بدي"] },
  { id: "ar-conv-08", locale: "ar", text: "هسه صرت أنام كتير وما بحب أطلع.", probes: ["هسه", "كتير"] },
  { id: "ar-conv-09", locale: "ar", text: "ليش دايماً بصير هيك معي؟", probes: ["question", "ليش"] },
  { id: "ar-conv-10", locale: "ar", text: "بصراحة، تعبت... بس ما بدي أحكي كتير.", probes: ["ellipsis", "بصراحة"] },
];

/** 10 Arabic clinical / psychiatric sentences. */
export const AR_CLINICAL: CorpusEntry[] = [
  { id: "ar-clin-01", locale: "ar", text: "الدكتور وصفلي Prozac من ٣ شهور.", probes: ["medication", "latin", "numeral"] },
  { id: "ar-clin-02", locale: "ar", text: "بآخذ ٥٠ مغ كل يوم بالصبح.", probes: ["numeral", "abbreviation"] },
  { id: "ar-clin-03", locale: "ar", text: "قالوا إنه عندي OCD بس أنا مش مقتنع.", probes: ["acronym", "code-switch"] },
  { id: "ar-clin-04", locale: "ar", text: "جربت CBT قبل سنتين وما زبط معي.", probes: ["acronym"] },
  { id: "ar-clin-05", locale: "ar", text: "صار عندي نوبات هلع أول مرة بعمر ٢٠.", probes: ["numeral", "terminology"] },
  { id: "ar-clin-06", locale: "ar", text: "د. سامي حولني على العيادة النفسية.", probes: ["abbreviation", "name"] },
  { id: "ar-clin-07", locale: "ar", text: "بحس بأعراض انسحاب لما أنسى الحبة.", probes: ["terminology"] },
  { id: "ar-clin-08", locale: "ar", text: "غيّروا الدوا من Zoloft على Lexapro.", probes: ["medication", "latin"] },
  { id: "ar-clin-09", locale: "ar", text: "الأرق صار كل ليلة تقريباً من ٦ أسابيع.", probes: ["numeral"] },
  { id: "ar-clin-10", locale: "ar", text: "ما عندي أفكار أذية لحالي، بس بحس بيأس.", probes: ["risk-language", "negation"] },
];

/** 10 emotionally nuanced Arabic sentences. */
export const AR_EMOTIONAL: CorpusEntry[] = [
  { id: "ar-emo-01", locale: "ar", text: "ما بعرف... بحس حالي فاضي من جوا.", probes: ["ellipsis", "affect"] },
  { id: "ar-emo-02", locale: "ar", text: "والله تعبت، بس ما بحب أحمّل حدا هم.", probes: ["affect"] },
  { id: "ar-emo-03", locale: "ar", text: "بخاف يحكموا علي إذا حكيت.", probes: ["stigma"] },
  { id: "ar-emo-04", locale: "ar", text: "أنا— لأ، خليني أرجع أحكي من الأول.", probes: ["false-start", "self-correction"] },
  { id: "ar-emo-05", locale: "ar", text: "مبين عليّ كثير؟ يعني واضح؟", probes: ["question", "asking-therapist"] },
  { id: "ar-emo-06", locale: "ar", text: "بعض الأيام بكون منيح... وبعدين بوقع فجأة.", probes: ["ellipsis", "affect-shift"] },
  { id: "ar-emo-07", locale: "ar", text: "ما بقدر أطلع بوجهك وأنا بحكي هيك.", probes: ["shame"] },
  { id: "ar-emo-08", locale: "ar", text: "خلص، مش قادر أكمل بالموضوع هلق.", probes: ["boundary", "هلق"] },
  { id: "ar-emo-09", locale: "ar", text: "صار زمان ما حسيت إني منيح.", probes: ["affect"] },
  { id: "ar-emo-10", locale: "ar", text: "بس... ليش عم تسألني هالسؤال؟", probes: ["ellipsis", "question"] },
];

/** 10 difficult pronunciation cases. */
export const AR_DIFFICULT: CorpusEntry[] = [
  { id: "ar-hard-01", locale: "ar", text: "أخذت ١٠٠٠ مغ بالغلط.", probes: ["numeral-1000", "abbreviation"] },
  { id: "ar-hard-02", locale: "ar", text: "الموعد الساعة 10:30 الصبح.", probes: ["time", "no-spell"] },
  { id: "ar-hard-03", locale: "ar", text: "الجرعة صارت 2.5 حبة.", probes: ["decimal", "no-spell"] },
  { id: "ar-hard-04", locale: "ar", text: "حكيت مع الطبيب على WhatsApp.", probes: ["loanword", "code-switch"] },
  { id: "ar-hard-05", locale: "ar", text: "قالولي إنه SSRI بس ما فهمت شو يعني.", probes: ["acronym", "question-word"] },
  { id: "ar-hard-06", locale: "ar", text: "بدي أعرف، ليش صار هيك؟ ما في سبب!", probes: ["mixed-terminals"] },
  { id: "ar-hard-07", locale: "ar", text: "عمري ٣٠ سنة وعندي ٢ ولاد.", probes: ["numeral", "gender-limitation"] },
  { id: "ar-hard-08", locale: "ar", text: "ما بديش أحكي عن هالموضوع.", probes: ["بديش", "negation"] },
  { id: "ar-hard-09", locale: "ar", text: "راجعت الـ PTSD clinic مرتين.", probes: ["acronym", "code-switch"] },
  { id: "ar-hard-10", locale: "ar", text: "من فترة طويلة، يعني من ٢٠١٩ تقريباً، وأنا هيك.", probes: ["year", "clause"] },
];

/** 10 English regression sentences — must round-trip unchanged. */
export const EN_REGRESSION: CorpusEntry[] = [
  { id: "en-reg-01", locale: "en", text: "I don't really know how to explain it.", probes: ["baseline"] },
  { id: "en-reg-02", locale: "en", text: "It started maybe six months ago, I think.", probes: ["comma"] },
  { id: "en-reg-03", locale: "en", text: "Do you think that's normal?", probes: ["question"] },
  { id: "en-reg-04", locale: "en", text: "My doctor put me on sertraline last spring.", probes: ["medication"] },
  { id: "en-reg-05", locale: "en", text: "Some days are fine and then it just drops.", probes: ["conjunction"] },
  { id: "en-reg-06", locale: "en", text: "I keep avoiding places where there are crowds.", probes: ["baseline"] },
  { id: "en-reg-07", locale: "en", text: "I'm not sure I want to talk about that yet.", probes: ["negation", "boundary"] },
  { id: "en-reg-08", locale: "en", text: "It's like my chest gets tight and I can't breathe.", probes: ["somatic"] },
  { id: "en-reg-09", locale: "en", text: "Nobody in my family talks about this stuff.", probes: ["stigma"] },
  { id: "en-reg-10", locale: "en", text: "Sorry, what was the question again?", probes: ["question", "forget"] },
];

export const SPEECH_CORPUS: CorpusEntry[] = [
  ...AR_CONVERSATIONAL,
  ...AR_CLINICAL,
  ...AR_EMOTIONAL,
  ...AR_DIFFICULT,
  ...EN_REGRESSION,
];

export const ARABIC_CORPUS = SPEECH_CORPUS.filter((e) => e.locale === "ar");
export const ENGLISH_CORPUS = SPEECH_CORPUS.filter((e) => e.locale === "en");

/**
 * Behavioural anchors (0–5) for each rubric item, given to the examiner so a
 * number means the same thing from one report to the next.
 *
 * Each anchor describes what the trainee did in the transcript, never what
 * the patient has. English and Arabic are written separately (not
 * translated); ids stay in English. An item without its own anchors (a
 * custom rubric row) gets the generic scale.
 */

export type RubricAnchors = readonly [string, string, string, string, string, string];

const EN: Record<string, RubricAnchors> = {
  alliance: [
    "Dismissive, judgemental or cold; the patient pulls back.",
    "Mostly mechanical questioning; feelings the patient shows are passed over.",
    "Polite and attentive, but reflections are rare or generic.",
    "Regular accurate reflections; the patient's feelings are named and validated.",
    "Reflections capture meaning as well as content; ruptures or hesitation are noticed and repaired.",
    "Consistently attuned; the patient opens up further because of how the trainee responds.",
  ],
  assessment: [
    "No exploration of the presenting problem.",
    "One or two closed questions; key areas (onset, duration, impact) untouched.",
    "Covers the main complaint but leaves obvious gaps (history, functioning, context).",
    "Explores onset, course, impact and context with a mix of open and closed questions.",
    "Systematic and paced exploration that follows the patient's cues and checks understanding.",
    "Thorough, well-sequenced assessment that also gathers strengths and supports and summarises back.",
  ],
  interventions: [
    "Harmful, contraindicated or premature advice.",
    "Generic reassurance or advice not tied to anything the patient said.",
    "Some fitting technique, but applied abruptly or without a rationale.",
    "Interventions fit the stage of the session and are explained to the patient.",
    "Interventions are collaborative, tailored to this patient and checked for fit.",
    "Skilful, well-timed interventions with a clear rationale and the patient's agreement on next steps.",
  ],
  safety: [
    "Clear risk cues ignored, or the trainee responds in an unsafe way.",
    "Risk raised only vaguely or too late; no follow-up on cues.",
    "Asks directly about risk but does not explore plan, intent, means or protective factors.",
    "Direct, calm risk inquiry with follow-up on plan, intent and protective factors.",
    "Structured risk inquiry plus a proportionate response (e.g. safety steps, support agreed).",
    "Thorough, compassionate risk assessment with a collaborative safety plan and clear follow-up.",
  ],
  structure: [
    "No discernible structure; the session drifts or ends abruptly.",
    "Little orientation or agenda; time is poorly used.",
    "Some structure (an opening or a close) but not both, or pacing is uneven.",
    "Clear opening, focus kept through the middle, and a close.",
    "Agenda agreed with the patient, transitions signposted, summary at the end.",
    "Well-paced throughout with a collaborative agenda, summaries, and agreed next steps.",
  ],
  dsm_reasoning: [
    "No diagnostic reasoning visible.",
    "Jumps to a label without gathering the criteria.",
    "Gathers some criteria-relevant information but leaves major criteria unexplored.",
    "Explores most relevant DSM-5 criteria, including duration and impairment.",
    "Systematically checks criteria and specifiers and avoids over-claiming.",
    "Precise, criteria-led reasoning that also checks exclusions and specifiers.",
  ],
  icd_reasoning: [
    "No diagnostic reasoning visible.",
    "Jumps to a label without gathering the essential features.",
    "Gathers some ICD-11 relevant features but leaves essential features unexplored.",
    "Explores most essential ICD-11 features, including course and functional impact.",
    "Systematically checks essential features and boundaries with normality.",
    "Precise, feature-led reasoning that also checks boundaries with other conditions.",
  ],
  clinical_formulation: [
    "No attempt to understand why the problem arose or continues.",
    "Isolated facts gathered with no attempt to link them.",
    "Some links between events, thoughts, feelings or behaviour, but incomplete.",
    "Explores precipitating and maintaining factors and begins to connect them.",
    "A coherent working formulation is developed and shared or checked with the patient.",
    "Rich, collaborative formulation covering predisposing, precipitating, perpetuating and protective factors.",
  ],
  differential_diagnosis: [
    "No alternatives considered.",
    "Alternatives mentioned but not explored.",
    "One alternative explored superficially.",
    "Relevant alternatives explored with targeted questions.",
    "Systematic rule-outs including medical, substance and other psychiatric causes.",
    "Thorough, well-reasoned differential that clearly narrows the possibilities.",
  ],
  risk_formulation: [
    "Risk not considered.",
    "A single yes/no risk question with no follow-up.",
    "Some risk factors gathered but not organised.",
    "Risk and protective factors gathered and weighed.",
    "Structured appraisal of risk level that informs the plan.",
    "Comprehensive, dynamic risk formulation linked to a clear management plan.",
  ],
  educational_competency: [
    "Session work shows no link to the session goals.",
    "Little visible connection to the stated goals.",
    "Some goals addressed, others ignored.",
    "Most stated goals addressed in the session.",
    "Goals addressed deliberately and with reflection on progress.",
    "All goals addressed with clear, self-aware practice of the target competencies.",
  ],
};

const AR: Record<string, RubricAnchors> = {
  alliance: [
    "رافض أو مُطلِق للأحكام أو بارد، فينسحب المريض.",
    "أسئلة آلية في الغالب، ويتجاوز المشاعر التي يُظهرها المريض.",
    "مهذّب ومنتبه، لكن عكس المشاعر نادر أو عام.",
    "يعكس المشاعر بدقة وبانتظام، ويسمّي مشاعر المريض ويُقرّها.",
    "يلتقط المعنى لا المحتوى فقط، ويلاحظ التردد أو التصدّع في العلاقة ويُصلحه.",
    "متناغم مع المريض طوال الجلسة، فينفتح المريض أكثر بسبب طريقة استجابته.",
  ],
  assessment: [
    "لا استكشاف للمشكلة الحالية.",
    "سؤال مغلق أو اثنان، دون التطرق إلى البداية أو المدة أو الأثر.",
    "يغطي الشكوى الرئيسية مع ثغرات واضحة (التاريخ، الأداء اليومي، السياق).",
    "يستكشف البداية والمسار والأثر والسياق بمزيج من الأسئلة المفتوحة والمغلقة.",
    "استكشاف منهجي متدرّج يتبع إشارات المريض ويتحقق من الفهم.",
    "تقييم شامل حسن الترتيب يجمع أيضاً نقاط القوة ومصادر الدعم ويلخّص للمريض.",
  ],
  interventions: [
    "نصيحة ضارة أو غير مناسبة أو سابقة لأوانها.",
    "طمأنة أو نصيحة عامة لا ترتبط بما قاله المريض.",
    "تقنية مناسبة إلى حدٍّ ما، لكنها تُطبَّق فجأة أو دون شرح.",
    "التدخلات تناسب مرحلة الجلسة ويشرح سببها للمريض.",
    "تدخلات تشاركية مفصّلة على هذا المريض ويتحقق من ملاءمتها له.",
    "تدخلات ماهرة في توقيتها، مسوّغة بوضوح، ويتفق مع المريض على الخطوات التالية.",
  ],
  safety: [
    "يتجاهل إشارات خطر واضحة، أو يستجيب بطريقة غير آمنة.",
    "يذكر الخطر بشكل مبهم أو متأخر، ولا يتابع الإشارات.",
    "يسأل مباشرة عن الخطر لكن لا يستكشف الخطة أو النية أو الوسيلة أو عوامل الحماية.",
    "سؤال مباشر وهادئ عن الخطر مع متابعة الخطة والنية وعوامل الحماية.",
    "استكشاف منظم للخطر مع استجابة متناسبة (خطوات أمان، دعم متفق عليه).",
    "تقييم خطر شامل ورحيم مع خطة أمان تشاركية ومتابعة واضحة.",
  ],
  structure: [
    "لا بنية واضحة؛ الجلسة تتشتت أو تنتهي فجأة.",
    "توجيه أو جدول أعمال ضئيل، والوقت مستخدم بشكل سيئ.",
    "بعض البنية (افتتاح أو ختام) لا كلاهما، أو الإيقاع غير متوازن.",
    "افتتاح واضح، وتركيز محفوظ في منتصف الجلسة، وختام.",
    "جدول أعمال متفق عليه مع المريض، وانتقالات معلنة، وملخص في النهاية.",
    "إيقاع جيد طوال الجلسة مع جدول أعمال تشاركي وملخصات وخطوات تالية متفق عليها.",
  ],
  dsm_reasoning: [
    "لا يظهر أي تفكير تشخيصي.",
    "يقفز إلى تسمية دون جمع المعايير.",
    "يجمع بعض المعلومات المتصلة بالمعايير ويترك معايير رئيسية دون استكشاف.",
    "يستكشف معظم معايير DSM-5 ذات الصلة، بما فيها المدة وضعف الأداء.",
    "يتحقق من المعايير والمحددات بشكل منهجي ويتجنب المبالغة في الاستنتاج.",
    "تفكير دقيق يقوده المعيار، ويتحقق أيضاً من الاستثناءات والمحددات.",
  ],
  icd_reasoning: [
    "لا يظهر أي تفكير تشخيصي.",
    "يقفز إلى تسمية دون جمع السمات الأساسية.",
    "يجمع بعض سمات ICD-11 ويترك سمات أساسية دون استكشاف.",
    "يستكشف معظم السمات الأساسية في ICD-11، بما فيها المسار والأثر الوظيفي.",
    "يتحقق من السمات الأساسية ومن الحدّ الفاصل مع الحالة الطبيعية بشكل منهجي.",
    "تفكير دقيق تقوده السمات، ويتحقق أيضاً من الحدود مع الحالات الأخرى.",
  ],
  clinical_formulation: [
    "لا محاولة لفهم سبب نشوء المشكلة أو استمرارها.",
    "حقائق متفرقة دون محاولة الربط بينها.",
    "بعض الروابط بين الأحداث والأفكار والمشاعر والسلوك، لكنها ناقصة.",
    "يستكشف العوامل المُرسِّبة والمُديمة ويبدأ بالربط بينها.",
    "يبني صياغة عمل متماسكة ويشاركها مع المريض أو يتحقق منها معه.",
    "صياغة غنية تشاركية تشمل العوامل المهيِّئة والمُرسِّبة والمُديمة والحامية.",
  ],
  differential_diagnosis: [
    "لا ينظر في أي بدائل.",
    "يذكر بدائل دون استكشافها.",
    "يستكشف بديلاً واحداً بشكل سطحي.",
    "يستكشف البدائل ذات الصلة بأسئلة موجّهة.",
    "استبعاد منهجي يشمل الأسباب الطبية والمواد والاضطرابات النفسية الأخرى.",
    "تشخيص تفريقي شامل حسن التسويغ يضيّق الاحتمالات بوضوح.",
  ],
  risk_formulation: [
    "لا ينظر في الخطر.",
    "سؤال واحد بنعم أو لا عن الخطر دون متابعة.",
    "يجمع بعض عوامل الخطر دون تنظيمها.",
    "يجمع عوامل الخطر والحماية ويوازن بينها.",
    "تقدير منظم لمستوى الخطر يوجّه الخطة.",
    "صياغة خطر شاملة ومتغيرة مرتبطة بخطة إدارة واضحة.",
  ],
  educational_competency: [
    "عمل الجلسة لا يرتبط بأهدافها.",
    "صلة ضئيلة ظاهرة بالأهداف المعلنة.",
    "يتناول بعض الأهداف ويتجاهل غيرها.",
    "يتناول معظم الأهداف المعلنة في الجلسة.",
    "يتناول الأهداف عن قصد مع تأمّل في التقدم.",
    "يتناول كل الأهداف مع ممارسة واعية وواضحة للكفاءات المستهدفة.",
  ],
};

const GENERIC_EN: RubricAnchors = [
  "Not attempted, or done in a way that could harm the patient.",
  "Barely attempted; major elements missing.",
  "Partly done, with clear gaps.",
  "Done adequately for the stage of the session.",
  "Done well, tailored to this patient.",
  "Done skilfully and consistently throughout.",
];

const GENERIC_AR: RubricAnchors = [
  "لم يُحاوَل، أو أُدّي بطريقة قد تؤذي المريض.",
  "محاولة ضئيلة مع غياب عناصر رئيسية.",
  "أُدّي جزئياً مع ثغرات واضحة.",
  "أُدّي بشكل كافٍ لمرحلة الجلسة.",
  "أُدّي جيداً ومفصّلاً على هذا المريض.",
  "أُدّي بمهارة وثبات طوال الجلسة.",
];

/** Anchors for one rubric item in the report language. */
export function rubricAnchors(id: string, language: "en" | "ar"): RubricAnchors {
  if (language === "ar") return AR[id] ?? GENERIC_AR;
  return EN[id] ?? GENERIC_EN;
}

/** True when the item has its own anchors (not the generic scale). */
export function hasOwnAnchors(id: string): boolean {
  return id in EN && id in AR;
}

/**
 * The rubric block for the examiner prompt: one line per item with its id,
 * label and weight, then its six anchors.
 */
export function formatRubricWithAnchors(
  rubric: { id: string; label: string; weight: number }[],
  language: "en" | "ar",
): string {
  const weightWord = language === "ar" ? "الوزن" : "weight";
  return rubric
    .map((r) => {
      const anchors = rubricAnchors(r.id, language)
        .map((a, score) => `  ${score}: ${a}`)
        .join("\n");
      return `${r.id} — ${r.label} (${weightWord} ${r.weight})\n${anchors}`;
    })
    .join("\n");
}

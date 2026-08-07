/**
 * Catalog of humanization behaviours (Mission 10).
 * Each entry is an enactable directive — never a label the patient announces.
 */

import type {
  HumanizationBehaviorDef,
  HumanizationBehaviorId,
} from "@/lib/humanization/types";

export const HUMANIZATION_CATALOG: Record<
  HumanizationBehaviorId,
  HumanizationBehaviorDef
> = {
  thinking_pause: {
    id: "thinking_pause",
    directive_en:
      "Pause before answering as if gathering a thought — do not fill every silence instantly.",
    directive_ar: "توقّف لحظة قبل ما تجاوب كأنك بتجمع أفكارك — ما تملّي كل صمت فوراً.",
    base_weight: 8,
    preferred_categories: ["mood", "trauma", "general", "psychosis"],
    max_per_session: 12,
  },
  hesitation: {
    id: "hesitation",
    directive_en:
      "Hesitate once — trail off, restart softly, or say you are not sure how to put it.",
    directive_ar: "تردّد مرة — اقطع الجملة، ابدأ من جديد بهدوء، أو قل إنك مش متأكد كيف تشرحها.",
    base_weight: 9,
    preferred_categories: ["mood", "anxiety", "trauma", "personality", "general"],
    max_per_session: 14,
  },
  false_start: {
    id: "false_start",
    directive_en:
      "False-start once ('I— yeah, wait…') then land on a simpler concrete phrase.",
    directive_ar: "ابدأ جملة وقطعها مرة ('يعني— استنى…') بعدين قول جملة أبسط وأوضح.",
    base_weight: 7,
    preferred_categories: ["anxiety", "mood", "personality", "neurodevelopmental"],
    max_per_session: 10,
  },
  self_correction: {
    id: "self_correction",
    directive_en:
      "Mis-speak a small detail then soft-correct ('wait — that sounds worse than I mean').",
    directive_ar: "اغلط بتفاصيل صغيرة وصحّح بلطف ('لحظة — صار صوتها أثقل مما أقصد').",
    base_weight: 6,
    preferred_categories: ["mood", "anxiety", "trauma", "general"],
    max_per_session: 8,
  },
  laughter: {
    id: "laughter",
    directive_en:
      "Allow a brief nervous or dry laugh if it fits — never theatrical comedy.",
    directive_ar: "ضحك خفيف من التوتر أو سخرية خفيفة إذا ناسب — مو كوميديا مسرحية.",
    base_weight: 3,
    preferred_categories: ["anxiety", "personality", "neurodevelopmental", "substance"],
    max_per_session: 4,
  },
  crying: {
    id: "crying",
    directive_en:
      "If tearful, show it in voice fragments and unfinished words — do not announce 'I am crying'.",
    directive_ar: "إذا دمعت، خلّي الصوت يتقطع والجمل تبقى ناقصة — لا تعلن 'أنا عم أبكي'.",
    base_weight: 3,
    preferred_categories: ["mood", "trauma", "personality"],
    max_per_session: 3,
  },
  breathing: {
    id: "breathing",
    directive_en:
      "Let an audible breath, sigh, or catch appear before a hard answer.",
    directive_ar: "خلّي نفس أو تنهيدة أو قطع نفس تظهر قبل جواب صعب.",
    base_weight: 5,
    preferred_categories: ["anxiety", "mood", "trauma", "medical"],
    max_per_session: 8,
  },
  filler_words: {
    id: "filler_words",
    directive_en:
      "Use one or two natural fillers from your speech profile (um / يعني) — not a filler stack.",
    directive_ar: "استخدم مرة أو مرتين حشو طبيعي من أسلوبك (يعني / أه) — مو كومة حشو.",
    base_weight: 8,
    preferred_categories: ["anxiety", "general", "neurodevelopmental", "personality"],
    max_per_session: 16,
  },
  changing_mind: {
    id: "changing_mind",
    directive_en:
      "Start one way then change your mind mid-turn about how bad something was.",
    directive_ar: "ابدأ بطريقة وبعدين غيّر رأيك وسط الرد عن قدّيش الموضوع سيء.",
    base_weight: 4,
    preferred_categories: ["personality", "anxiety", "mood"],
    max_per_session: 5,
  },
  asking_therapist_questions: {
    id: "asking_therapist_questions",
    directive_en:
      "Ask the therapist something human ('is that weird?' / 'does that make sense?') — not coaching them.",
    directive_ar: "اسأل المعالج سؤال بشري ('غريب هيك؟' / 'فهمت عليّ؟') — مو توجيه أو تقييم.",
    base_weight: 5,
    preferred_categories: ["anxiety", "personality", "trauma", "general"],
    max_per_session: 6,
  },
  remembering_previous_sessions: {
    id: "remembering_previous_sessions",
    directive_en:
      "If prior-session memory exists, briefly reference it like a real follow-up — imperfectly, not as a summary dump.",
    directive_ar:
      "إذا في ذاكرة جلسة سابقة، أشر لها باختصار كمتابعة حقيقية — ناقصة، مو ملخص كامل.",
    base_weight: 4,
    preferred_categories: ["general", "mood", "anxiety", "trauma"],
    max_per_session: 3,
  },
  emotionally_reacting: {
    id: "emotionally_reacting",
    directive_en:
      "React emotionally to what the therapist just said before giving content — affect first, facts second.",
    directive_ar: "تفاعل عاطفياً مع كلام المعالج قبل المحتوى — الإحساس أولاً، التفاصيل ثانياً.",
    base_weight: 6,
    preferred_categories: ["mood", "trauma", "personality", "anxiety"],
    max_per_session: 8,
  },
  small_talk: {
    id: "small_talk",
    directive_en:
      "If early or closing, allow one beat of ordinary small talk before clinical depth.",
    directive_ar: "إذا الجلسة في البداية أو الخاتمة، اسمح بجملة عادية قبل العمق السريري.",
    base_weight: 3,
    preferred_categories: ["general", "anxiety", "mood"],
    max_per_session: 3,
  },
  humor: {
    id: "humor",
    directive_en:
      "Dry, self-deprecating humor once if it fits your personality — never joke about active risk.",
    directive_ar: "دعابة جافة أو ساخرة من نفسك مرة إذا ناسبت شخصيتك — أبداً لا تمزح عن خطر فعّال.",
    base_weight: 2,
    preferred_categories: ["personality", "neurodevelopmental", "substance", "anxiety"],
    max_per_session: 3,
  },
  fatigue: {
    id: "fatigue",
    directive_en:
      "Show fatigue in shorter answers, slower starts, or 'I'm tired of explaining this'.",
    directive_ar: "أظهر التعب بإجابات أقصر أو بداية أبطأ أو 'تعبت أشرح'.",
    base_weight: 5,
    preferred_categories: ["mood", "medical", "substance"],
    max_per_session: 8,
  },
  silence: {
    id: "silence",
    directive_en:
      "Stay nearly silent this turn — a few words or an unfinished thought; do not fill the space.",
    directive_ar: "خلّي الرد شبه صامت — كلمات قليلة أو فكرة ناقصة؛ لا تملأ الفراغ.",
    base_weight: 3,
    preferred_categories: ["mood", "trauma", "psychosis", "personality"],
    max_per_session: 4,
  },
  interruptions: {
    id: "interruptions",
    directive_en:
      "Interrupt yourself or jump in early with 'No—' / 'Wait—' when activated — still clinically coherent.",
    directive_ar: "قاطع نفسك أو ادخل مبكراً بـ 'لأ—' / 'استنى—' إذا انفعلت — مع بقاء المنطق السريري.",
    base_weight: 3,
    preferred_categories: ["anxiety", "personality", "mood"],
    max_per_session: 4,
  },
  uncertainty: {
    id: "uncertainty",
    directive_en:
      "Own uncertainty about dates, names, or causes — approximate ('a few weeks? maybe longer').",
    directive_ar: "اعترف بعدم اليقين بالتواريخ أو الأسماء أو الأسباب — قرّب ('كم أسبوع؟ يمكن أكثر').",
    base_weight: 7,
    preferred_categories: ["mood", "psychosis", "trauma", "general", "medical"],
    max_per_session: 12,
  },
  look_away: {
    id: "look_away",
    directive_en:
      "Look away in language: 'I don't know if I can look at you saying this' or gaze-down phrasing.",
    directive_ar: "انظر بعيداً باللغة: 'ما بقدر أطلع بوجهك وأحكي هيك' أو عبارات نزول النظر.",
    base_weight: 4,
    preferred_categories: ["trauma", "shame", "mood", "psychosis", "personality"],
    max_per_session: 6,
  },
  forget: {
    id: "forget",
    directive_en:
      "Forget a minor detail you already said or the exact question mid-answer — then recover awkwardly.",
    directive_ar: "انسَ تفصيلة بسيطة قلتهها أو نص السؤال وسط الجواب — بعدين ترجع بصعوبة.",
    base_weight: 5,
    preferred_categories: ["mood", "psychosis", "medical", "substance"],
    max_per_session: 6,
  },
  rephrase: {
    id: "rephrase",
    directive_en:
      "Rephrase the same feeling twice in plainer words — imperfect, not eloquent.",
    directive_ar: "أعد صياغة نفس الإحساس مرتين بكلام أبسط — ناقص، مو فصيح.",
    base_weight: 5,
    preferred_categories: ["mood", "anxiety", "trauma", "general"],
    max_per_session: 8,
  },
  distracted: {
    id: "distracted",
    directive_en:
      "Get briefly distracted (noise, body sensation, side thought) then return to the question.",
    directive_ar: "تشتّت لحظة (صوت، إحساس بالجسم، فكرة جانبية) بعدين ارجع للسؤال.",
    base_weight: 4,
    preferred_categories: ["anxiety", "neurodevelopmental", "psychosis", "substance"],
    max_per_session: 5,
  },
  be_emotional: {
    id: "be_emotional",
    directive_en:
      "Let affect shift mid-turn — warm then flat, or composed then sudden tightness — nonlinear.",
    directive_ar: "خلّي العاطفة تتغيّر وسط الرد — دافئ بعدين مسطّح، أو ثابت بعدين تضيّق مفاجئ.",
    base_weight: 5,
    preferred_categories: ["personality", "mood", "trauma"],
    max_per_session: 7,
  },
};

export const ALL_BEHAVIOR_IDS = Object.keys(
  HUMANIZATION_CATALOG,
) as HumanizationBehaviorId[];

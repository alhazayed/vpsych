/**
 * Clinical Educator rubrics — 10 OSCE-style dimensions with 0–5 anchors.
 * Labels are natively authored EN/AR (not machine-translated).
 */

import type {
  ClinicalEducatorDimensionId,
  ClinicalEducatorRubricItem,
  RubricAnchor,
} from "@/lib/clinical-educator/types";
import { CLINICAL_EDUCATOR_DIMENSION_IDS } from "@/lib/clinical-educator/types";

type RubricItem = ClinicalEducatorRubricItem;
type Anchor = RubricAnchor;

/** Mission 9 rubric schema id — locked into scientific provenance. */
export const CLINICAL_EDUCATOR_RUBRIC_VERSION = "clinical-educator-v1";
export const CLINICAL_EDUCATOR_VERSION = "1.0.0";

function anchors(
  rows: Array<{
    score: 0 | 1 | 2 | 3 | 4 | 5;
    en: [string, string];
    ar: [string, string];
  }>,
): Anchor[] {
  return rows.map((r) => ({
    score: r.score,
    label_en: r.en[0],
    description_en: r.en[1],
    label_ar: r.ar[0],
    description_ar: r.ar[1],
  }));
}

const STANDARD_SCALE = anchors([
  {
    score: 0,
    en: ["Absent", "No observable evidence in the transcript."],
    ar: ["غائب", "لا دليل ملاحظ في نص المحادثة."],
  },
  {
    score: 1,
    en: ["Minimal", "Token or superficial attempt; major gaps."],
    ar: ["ضئيل", "محاولة سطحية؛ فجوات كبيرة."],
  },
  {
    score: 2,
    en: ["Developing", "Partial skill with inconsistent execution."],
    ar: ["في طور النمو", "مهارة جزئية بتنفيذ غير ثابت."],
  },
  {
    score: 3,
    en: ["Adequate", "Meets basic expectations for a supervised trainee."],
    ar: ["كافٍ", "يلبّي التوقعات الأساسية لمتدرّب تحت إشراف."],
  },
  {
    score: 4,
    en: ["Proficient", "Consistent, specific, clinically useful work."],
    ar: ["متقن", "عمل ثابت ومحدد ومفيد سريرياً."],
  },
  {
    score: 5,
    en: ["Exemplary", "Nuanced, patient-centered, coachable as a model."],
    ar: ["نموذجي", "دقيق ومتمحور حول المريض؛ يصلح كنموذج."],
  },
]);

/** Equal weights (10 × 10 = 100) so composite remains a proper weighted %. */
export const CLINICAL_EDUCATOR_WEIGHTS: Record<
  ClinicalEducatorDimensionId,
  number
> = Object.fromEntries(
  CLINICAL_EDUCATOR_DIMENSION_IDS.map((id) => [id, 10]),
) as Record<ClinicalEducatorDimensionId, number>;

export const CLINICAL_EDUCATOR_RUBRIC: RubricItem[] = [
  {
    id: "rapport",
    label_en: "Rapport",
    label_ar: "بناء الألفة",
    weight: 10,
    max: 5,
    guidance_en:
      "Warm greeting, name use, collaborative tone, and early trust-building without rushing into interrogation.",
    guidance_ar:
      "ترحيب دافئ، استخدام الاسم، نبرة تعاونية، وبناء ثقة مبكر دون التحوّل سريعاً إلى استجواب.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "nice to meet",
      "glad",
      "welcome",
      "my name",
      "together",
      "comfortable",
      "أهلا",
      "مرحبا",
      "سعيد",
      "معاً",
      "مرتاح",
    ],
  },
  {
    id: "empathy",
    label_en: "Empathy",
    label_ar: "التعاطف",
    weight: 10,
    max: 5,
    guidance_en:
      "Accurate reflections of affect and meaning; validation without premature advice or empty reassurance.",
    guidance_ar:
      "عكس دقيق للعاطفة والمعنى؛ مصادقة دون نصيحة مبكرة أو تطمينات فارغة.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "sounds like",
      "hear",
      "must be",
      "that feels",
      "understand",
      "validate",
      "يبدو",
      "أسمع",
      "تشعر",
      "أفهم",
      "صعب",
    ],
  },
  {
    id: "risk_assessment",
    label_en: "Risk assessment",
    label_ar: "تقييم المخاطر",
    weight: 10,
    max: 5,
    guidance_en:
      "Direct, calm inquiry into suicidal ideation, intent, plan, means, protective factors, and safety planning when indicated.",
    guidance_ar:
      "استفسار مباشر وهادئ عن الأفكار الانتحارية والنية والخطة والوسائل والعوامل الوقائية وتخطيط السلامة عند الحاجة.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "suicid",
      "harm",
      "safe",
      "kill",
      "hurt yourself",
      "plan",
      "intent",
      "انتحار",
      "أذى",
      "آمن",
      "خطة",
      "إيذاء",
    ],
  },
  {
    id: "history_taking",
    label_en: "History taking",
    label_ar: "أخذ التاريخ المرضي",
    weight: 10,
    max: 5,
    guidance_en:
      "Systematic exploration of HPI, timeline, sleep/appetite, substances, supports, and relevant psychiatric/medical history.",
    guidance_ar:
      "استكشاف منهجي للشكوى والتسلسل الزمني والنوم/الشهية والمواد والدعم والتاريخ النفسي/الطبي ذي الصلة.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "when did",
      "how long",
      "sleep",
      "appetite",
      "history",
      "started",
      "medication",
      "متى",
      "منذ",
      "نوم",
      "شهية",
      "تاريخ",
      "دواء",
    ],
  },
  {
    id: "dsm_reasoning",
    label_en: "DSM reasoning",
    label_ar: "التفكير وفق DSM",
    weight: 10,
    max: 5,
    guidance_en:
      "Criteria-linked differential thinking (DSM-5) grounded in transcript evidence — not premature labeling.",
    guidance_ar:
      "تفكير تفريقي مرتبط بالمعايير (DSM-5) مستند إلى أدلة النص — دون تصنيف مبكر.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "dsm",
      "criteria",
      "diagnosis",
      "differential",
      "symptoms",
      "episode",
      "تشخيص",
      "معايير",
      "تفريق",
      "أعراض",
      "نوبة",
    ],
  },
  {
    id: "therapeutic_alliance",
    label_en: "Therapeutic alliance",
    label_ar: "التحالف العلاجي",
    weight: 10,
    max: 5,
    guidance_en:
      "Shared goals/tasks, repair of ruptures, collaborative stance, and invitation of patient agency.",
    guidance_ar:
      "أهداف ومهام مشتركة، إصلاح الانقطاعات، موقف تعاوني، ودعوة لوكالة المريض.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "we can",
      "work together",
      "goal",
      "what matters",
      "your preference",
      "alliance",
      "معاً",
      "هدف",
      "يهمك",
      "تفضيل",
      "نعمل",
    ],
  },
  {
    id: "communication",
    label_en: "Communication",
    label_ar: "التواصل",
    weight: 10,
    max: 5,
    guidance_en:
      "Clear, paced language; open questions; summaries; avoidance of jargon dumps and stacked questions.",
    guidance_ar:
      "لغة واضحة ومتوازنة؛ أسئلة مفتوحة؛ تلخيص؛ تجنّب المصطلحات المتراكمة والأسئلة المتتالية.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "tell me more",
      "what I hear",
      "summar",
      "clarify",
      "open",
      "can you say",
      "أخبرني",
      "ما أسمعه",
      "لخّص",
      "وضح",
      "أكثر",
    ],
  },
  {
    id: "professionalism",
    label_en: "Professionalism",
    label_ar: "الاحترافية",
    weight: 10,
    max: 5,
    guidance_en:
      "Boundaries, respectful framing, ethical stance, and appropriate role as trainee clinician.",
    guidance_ar:
      "حدود مهنية، صياغة محترمة، موقف أخلاقي، ودور مناسب كمتدرّب سريري.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "confidential",
      "consent",
      "boundary",
      "role",
      "respect",
      "professional",
      "سرية",
      "موافقة",
      "حدود",
      "دور",
      "احترام",
    ],
  },
  {
    id: "session_structure",
    label_en: "Session structure",
    label_ar: "بنية الجلسة",
    weight: 10,
    max: 5,
    guidance_en:
      "Opening agenda, mid-session pacing, time checks, and a coherent closing/summary.",
    guidance_ar:
      "أجندة افتتاح، إيقاع منتصف الجلسة، مراقبة الوقت، وإغلاق/تلخيص متماسك.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "today",
      "agenda",
      "summarize",
      "before we end",
      "next time",
      "homework",
      "اليوم",
      "أجندة",
      "نلخّص",
      "قبل أن ننهي",
      "المرة القادمة",
      "واجب",
    ],
  },
  {
    id: "treatment_planning",
    label_en: "Treatment planning",
    label_ar: "التخطيط العلاجي",
    weight: 10,
    max: 5,
    guidance_en:
      "Collaborative next steps, modality fit, psychoeducation, and realistic between-session plans.",
    guidance_ar:
      "خطوات تالية تشاركية، ملاءمة الأسلوب، تثقيف نفسي، وخطط واقعية بين الجلسات.",
    anchors: STANDARD_SCALE,
    example_cues: [
      "plan",
      "next step",
      "cbt",
      "therapy",
      "homework",
      "options",
      "treatment",
      "خطة",
      "خطوة",
      "علاج",
      "خيارات",
      "واجب",
    ],
  },
];

export function rubricById(
  id: ClinicalEducatorDimensionId,
): RubricItem {
  const found = CLINICAL_EDUCATOR_RUBRIC.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown clinical educator dimension: ${id}`);
  return found;
}

export function localizeDimensionLabel(
  id: ClinicalEducatorDimensionId,
  language: "en" | "ar",
): string {
  const r = rubricById(id);
  return language === "ar" ? r.label_ar : r.label_en;
}

export function toAssessmentRubricItems(language: "en" | "ar") {
  return CLINICAL_EDUCATOR_RUBRIC.map((r) => ({
    id: r.id,
    label: language === "ar" ? r.label_ar : r.label_en,
    weight: r.weight,
    max: r.max as number,
  }));
}

export function assertClinicalEducatorWeights(): void {
  const sum = CLINICAL_EDUCATOR_RUBRIC.reduce((s, r) => s + r.weight, 0);
  if (sum !== 100) {
    throw new Error(
      `Clinical Educator weights must sum to 100 (got ${sum})`,
    );
  }
  for (const id of CLINICAL_EDUCATOR_DIMENSION_IDS) {
    if (!CLINICAL_EDUCATOR_RUBRIC.some((r) => r.id === id)) {
      throw new Error(`Missing rubric item for ${id}`);
    }
  }
}

assertClinicalEducatorWeights();

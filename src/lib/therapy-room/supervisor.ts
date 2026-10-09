/**
 * Residency-style supervisor briefing from ACE coach_feedback + nonverbal context.
 * Educational only — never exposes admin session_reports scores/narrative.
 */

import type { PatientNonverbalProfile, SupervisorBriefing } from "./types";

type CoachRow = {
  supervisor_feedback?: string | null;
  reflective_questions?: unknown;
  missed_opportunities?: unknown;
  suggested_reading?: unknown;
  suggested_next_cases?: unknown;
  learning_goals?: unknown;
  improvement_plan?: string | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

type BriefingCopy = {
  whatHappened: (patient: string) => string;
  patientFallback: string;
  behaviourFromDiagnosis: (dx: string) => string;
  behaviourGeneric: string;
  workingToward: (goal: string) => string;
  strengths: string[];
  considerNext: (c: string) => string;
  alternatives: string[];
  pearls: string[];
  missed: string[];
  evidence: string[];
  literature: string[];
  progression: string[];
  questions: string[];
  improvementPlan: string;
};

const COPY: Record<"en" | "ar", BriefingCopy> = {
  en: {
    whatHappened: (p) =>
      `You completed an outpatient encounter with ${p}. Let's review process, alliance, and clinical reasoning — not a scorecard.`,
    patientFallback: "the patient",
    behaviourFromDiagnosis: (dx) =>
      `Behaviour followed the ${dx} presentation and session difficulty — not randomness.`,
    behaviourGeneric:
      "Patient behaviour followed the clinical presentation and alliance state.",
    workingToward: (g) => `You are working toward: ${g}`,
    strengths: [
      "You stayed with the patient through the full clinic visit.",
      "Continuing structured practice builds competency over sessions.",
    ],
    considerNext: (c) => `Consider next: ${c}`,
    alternatives: [
      "Slow down after affect appears — reflect before the next fact question.",
      "Close with a collaborative agenda and one concrete homework item.",
    ],
    pearls: [
      "Alliance before agenda when affect rises.",
      "Risk enquiry is a conversation, not a checklist dump.",
      "One accurate feeling reflection often opens more than three clarifying questions.",
    ],
    missed: [
      "Review whether risk, substances, and trauma gates were opened when indicated.",
    ],
    evidence: [
      "Use a structured risk formulation before ending elevated-risk visits.",
      "Match intervention dose to alliance — premature advice hardens resistance.",
    ],
    literature: [
      "Clinical interviewing skills checklist",
      "Relevant APA practice guideline module",
    ],
    progression: [
      "Continue deliberate practice on diagnostic interview structure.",
    ],
    questions: [
      "What cue might you have missed in the first five minutes?",
      "How did alliance affect disclosure — what would you do differently?",
    ],
    improvementPlan:
      "1. Use a structured checklist before ending (risk, differentials, MSE).\n2. Annotate one takeaway per case.\n3. Repeat a focused case on your weakest competency.",
  },
  ar: {
    whatHappened: (p) =>
      `أنهيت لقاءً في العيادة الخارجية مع ${p}. لنراجع سير الجلسة والتحالف العلاجي والتفكير السريري، فهذه ليست بطاقة درجات.`,
    patientFallback: "المريض",
    behaviourFromDiagnosis: (dx) =>
      `جاء سلوك المريض متّسقاً مع صورة ${dx} ومع مستوى صعوبة الجلسة، ولم يكن عشوائياً.`,
    behaviourGeneric:
      "جاء سلوك المريض متّسقاً مع الصورة السريرية ومع حالة التحالف العلاجي.",
    workingToward: (g) => `تعمل على تحقيق: ${g}`,
    strengths: [
      "بقيت حاضراً مع المريض طوال الزيارة.",
      "الاستمرار في التدرّب المنظّم يبني الكفاءة عبر الجلسات.",
    ],
    considerNext: (c) => `فكّر في الحالة التالية: ${c}`,
    alternatives: [
      "تمهّل عندما تظهر المشاعر، وعكسها قبل أن تطرح سؤال المعلومة التالي.",
      "اختم بجدول أعمال متّفق عليه مع المريض ومهمة منزلية واحدة محدّدة.",
    ],
    pearls: [
      "التحالف قبل جدول الأعمال عندما ترتفع المشاعر.",
      "السؤال عن الخطورة حوار، وليس قائمة أسئلة تُلقى دفعة واحدة.",
      "عكسٌ دقيق واحد للمشاعر يفتح غالباً أكثر مما تفتحه ثلاثة أسئلة توضيحية.",
    ],
    missed: [
      "راجع هل فتحت موضوعات الخطورة والمواد والصدمة عندما استدعى الموقف ذلك.",
    ],
    evidence: [
      "استخدم صياغة منظّمة للخطورة قبل إنهاء الزيارات مرتفعة الخطورة.",
      "وازن جرعة التدخّل مع قوة التحالف، فالنصيحة المبكرة تزيد المقاومة.",
    ],
    literature: [
      "قائمة مهارات المقابلة السريرية",
      "وحدة دليل الممارسة ذات الصلة من الجمعية الأمريكية لعلم النفس (APA)",
    ],
    progression: ["واصل التدرّب المقصود على بنية المقابلة التشخيصية."],
    questions: [
      "ما الإشارة التي ربما فاتتك في الدقائق الخمس الأولى؟",
      "كيف أثّر التحالف في إفصاح المريض، وما الذي ستفعله بشكل مختلف؟",
    ],
    improvementPlan:
      "1. استخدم قائمة تحقّق منظّمة قبل الإنهاء (الخطورة، التشخيص التفريقي، فحص الحالة العقلية).\n2. دوّن فكرة رئيسية واحدة من كل حالة.\n3. أعد حالة مركّزة على أضعف كفاءاتك.",
  },
};

export function buildSupervisorBriefing(opts: {
  sessionId: string;
  coach: CoachRow | null | undefined;
  nonverbal?: PatientNonverbalProfile | null;
  patientDisplay?: string;
  diagnosisLabel?: string | null;
  /** UI language of the debrief. Fallback copy is authored in both. */
  locale?: string;
}): SupervisorBriefing {
  const ar = opts.locale?.toLowerCase().startsWith("ar") ?? false;
  const copy = COPY[ar ? "ar" : "en"];
  const coach = opts.coach ?? {};
  const missed = asStringArray(coach.missed_opportunities);
  const reading = asStringArray(coach.suggested_reading);
  const goals = asStringArray(coach.learning_goals);
  const questions = asStringArray(coach.reflective_questions);
  const nextCases = asStringArray(coach.suggested_next_cases);
  // The nonverbal cue strings are English-only, so the Arabic briefing
  // explains behaviour from the presentation instead of quoting them.
  const nv = ar ? null : opts.nonverbal;

  const whatHappened =
    coach.supervisor_feedback?.trim() ||
    copy.whatHappened(opts.patientDisplay ?? copy.patientFallback);

  const whyPatientBehaved = nv
    ? [
        `In the room, expect ${nv.posture}`,
        `Eye contact pattern: ${nv.eyeContact}`,
        `Speech tempo: ${nv.speechTempo}.`,
        `Defences active today: ${nv.defenceMechanisms.join(", ")}.`,
        nv.allianceDevelopment,
        nv.disclosureTiming,
      ].join(" ")
    : opts.diagnosisLabel
      ? copy.behaviourFromDiagnosis(opts.diagnosisLabel)
      : copy.behaviourGeneric;

  return {
    sessionId: opts.sessionId,
    whatHappened,
    whyPatientBehaved,
    missedOpportunities: missed.length ? missed : copy.missed,
    strengths: goals.length ? goals.map(copy.workingToward) : copy.strengths,
    alternativeInterventions: nextCases.length
      ? nextCases.map(copy.considerNext)
      : copy.alternatives,
    clinicalPearls: copy.pearls,
    evidenceBasedRecommendations: copy.evidence,
    relevantLiterature: reading.length ? reading : copy.literature,
    competencyProgression: goals.length ? goals : copy.progression,
    reflectiveQuestions: questions.length ? questions : copy.questions,
    improvementPlan: coach.improvement_plan?.trim() || copy.improvementPlan,
  };
}

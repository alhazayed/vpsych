/**
 * Mission 29 — Brand & Conversion persona journeys.
 * Documents expected public paths for conversion and trust.
 */

export type BrandPersona =
  | "first_time_visitor"
  | "medical_student"
  | "psychologist"
  | "psychiatrist"
  | "university"
  | "hospital";

export type JourneyStep = {
  path: string;
  intent: string;
};

export const BRAND_VALUE_PROPOSITION = {
  en: "Safe, repeatable AI patient practice for psychiatric and psychotherapy training — with competency feedback under clinician/faculty control.",
  ar: "تدريب آمن وقابل للتكرار مع مرضى بالذكاء الاصطناعي للطب النفسي والعلاج النفسي — مع ملاحظات كفاءة تحت إشراف السريري/الهيئة التدريسية.",
} as const;

export const BRAND_PERSONA_JOURNEYS: Record<
  BrandPersona,
  { label: string; steps: JourneyStep[]; primaryCta: string }
> = {
  first_time_visitor: {
    label: "First-time visitor",
    primaryCta: "/signup",
    steps: [
      { path: "/", intent: "Understand value proposition and bilingual brand" },
      { path: "/#features", intent: "Scan capability set" },
      { path: "/pricing", intent: "Compare plans" },
      { path: "/signup", intent: "Create account" },
      { path: "/avatars", intent: "First practice selection (post-auth)" },
    ],
  },
  medical_student: {
    label: "Medical student",
    primaryCta: "/signup",
    steps: [
      { path: "/", intent: "Confidence before clinical rotations" },
      { path: "/clinical", intent: "Training workflow without real patients" },
      { path: "/faq", intent: "Safety and Arabic support answers" },
      { path: "/signup", intent: "Free / learner signup" },
    ],
  },
  psychologist: {
    label: "Psychologist",
    primaryCta: "/signup",
    steps: [
      { path: "/", intent: "Therapeutic alliance practice pitch" },
      { path: "/about", intent: "Educational stance and non-claims" },
      { path: "/research", intent: "CBME / simulation context citations" },
      { path: "/signup", intent: "Professional plan entry" },
    ],
  },
  psychiatrist: {
    label: "Psychiatrist",
    primaryCta: "/signup",
    steps: [
      { path: "/clinical", intent: "Interview + competency workflow" },
      { path: "/research", intent: "DSM/ICD educational framing" },
      { path: "/pricing", intent: "Professional vs Institution" },
      { path: "/signup", intent: "Individual practitioner signup" },
    ],
  },
  university: {
    label: "University / training program",
    primaryCta: "/contact",
    steps: [
      { path: "/pricing", intent: "Institution tier" },
      { path: "/clinical", intent: "Faculty review model" },
      { path: "/help", intent: "Deployment support paths" },
      { path: "/contact", intent: "Contact sales / institutional pilot" },
      { path: "/terms", intent: "Legal review before procurement" },
    ],
  },
  hospital: {
    label: "Hospital / clinic education office",
    primaryCta: "/contact",
    steps: [
      { path: "/about", intent: "Confirm not an EHR / not real-patient care" },
      { path: "/privacy", intent: "Training-data privacy posture" },
      { path: "/contact", intent: "Enterprise conversation" },
      { path: "/faq", intent: "Supervisor review and data FAQs" },
    ],
  },
};

export const BRAND_PUBLIC_TRUST_PATHS = [
  "/about",
  "/faq",
  "/contact",
  "/research",
  "/clinical",
  "/help",
  "/pricing",
  "/terms",
  "/privacy",
] as const;

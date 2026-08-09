"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  startTransition,
  useTransition,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { AdvancedDetails, AdvancedJson } from "@/components/admin/AdvancedDetails";
import type { AvatarPersonality, ClinicalCore, VoiceProfile } from "@/lib/types";
import type { HumanPersonalityProfile } from "@/lib/personality-engine/types";

/** Mirrors Phase 3A `/api/admin/avatars` write + validation shapes (client-side). */
type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
  severity: "error" | "warning";
  gate?: string;
};

type ValidationResult = {
  ok: boolean;
  publishReady: boolean;
  issues: ValidationIssue[];
  gates: Record<string, { ok: boolean; label: string }>;
};

type VirtualPatientWriteInput = {
  slug?: string;
  default_locale?: string;
  clinical_core?: ClinicalCore | null;
  personalities?: Partial<Record<string, AvatarPersonality>> | null;
  human_personality?: Record<string, unknown> | null;
  rubric?: unknown;
  ideal_guidelines?: unknown;
  voice_profile_id?: string | null;
  voice_id?: string | null;
  voice_id_ar?: string | null;
  persona?: {
    create?: boolean;
    default_disorder_id?: string | null;
    default_disorder_slug?: string | null;
    display_name?: string;
    slug?: string;
    identity?: Record<string, unknown>;
    traits?: Record<string, unknown>;
  } | null;
};

export type WizardVoiceOption = Pick<
  VoiceProfile,
  "id" | "voice_name" | "language" | "dialect" | "gender" | "is_active"
>;

export type WizardDisorderOption = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  category?: string | null;
};

type StepId =
  | "identity"
  | "clinical"
  | "personality"
  | "english"
  | "arabic"
  | "voice"
  | "therapy"
  | "preview"
  | "validation"
  | "save";

const STEPS: StepId[] = [
  "identity",
  "clinical",
  "personality",
  "english",
  "arabic",
  "voice",
  "therapy",
  "preview",
  "validation",
  "save",
];

const ATTACHMENT = [
  "secure",
  "anxious_preoccupied",
  "dismissive_avoidant",
  "fearful_avoidant",
  "disorganized",
] as const;

const COPING = [
  "problem_focused",
  "emotion_focused",
  "avoidant",
  "support_seeking",
  "intellectualizing",
  "withdrawal",
  "reassurance_seeking",
  "somatic",
  "mixed",
] as const;

const HUMOR = [
  "none",
  "dry",
  "self_deprecating",
  "warm",
  "deflective",
  "dark",
  "rare_soft",
] as const;

const REGULATION = [
  "expressive",
  "suppressive",
  "volatile",
  "intellectualized",
  "somatic_channel",
  "delayed_flood",
  "mixed",
] as const;

const fieldClass =
  "rounded-lg border border-[var(--outline-variant)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--on-surface)]";
const labelClass =
  "flex flex-col gap-1 text-xs font-medium text-[var(--outline)]";

function parseLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function linesFrom(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join("\n");
  return "";
}

function emptyLocalePersonality(
  locale: "en-US" | "ar-JO",
): AvatarPersonality {
  const isAr = locale === "ar-JO";
  return {
    locale,
    language: isAr ? "ar" : "en",
    language_native_name: isAr ? "العربية" : "English",
    dialect: isAr ? "Jordanian Arabic" : "American English",
    direction: isAr ? "rtl" : "ltr",
    authored_natively: true,
    never_translate: true,
    identity: {
      display_name: "",
      city: "",
      country: "",
      occupation: "",
    },
    persona_prompt: "",
    speech: {
      register: "colloquial",
      sample_utterances: [],
    },
    cultural_context: {
      stigma_framing: isAr ? "" : "",
      help_seeking_attitude: "",
    },
    language_module: {
      directive: isAr
        ? "تحدّثي باللهجة الأردنية الطبيعية."
        : "Speak natural American English.",
      fallback_replies: isAr ? ["ما بعرف"] : ["I don't know"],
    },
    safety_module: {
      crisis_resources: [{ name: "Crisis", contact: "911" }],
      risk_disclosure_style: "cautious",
      boundary_rules: ["Stay in character as the patient"],
    },
    voice: {
      stt_lang: isAr ? "ar" : "en",
      tts_lang: isAr ? "ar" : "en",
    },
  };
}

function defaultHumanPersonality(
  locale: "en-US" | "ar-JO",
  slug: string,
): HumanPersonalityProfile {
  const isAr = locale === "ar-JO";
  return {
    version: 1,
    avatar_slug: slug || undefined,
    locale,
    temperament: isAr
      ? "هادئة ظاهرياً مع قلق داخلي"
      : "Quietly anxious, warm when trust builds",
    attachment_style: "anxious_preoccupied",
    attachment_notes: isAr
      ? "تحتاج طمأنة دون ضغط؛ تخاف من الرفض"
      : "Needs reassurance without pressure; fears rejection",
    intelligence: {
      band: "above_average",
      strengths: isAr
        ? ["ملاحظة التفاصيل الاجتماعية", "تعبير مجازي"]
        : ["Social nuance", "Metaphorical expression"],
      style: isAr
        ? "تفكّر بصوت عالٍ ثم تتراجع"
        : "Thinks aloud then pulls back",
    },
    education: isAr ? "بكالوريوس" : "Bachelor's degree",
    occupation: isAr ? "مصممة" : "Designer",
    culture: isAr ? "أردنية حضرية" : "Urban American",
    religion: isAr ? "مسلمة غير ملتزمة يومياً" : "Spiritual but not observant",
    resilience: 3,
    openness: 3,
    agreeableness: 4,
    conscientiousness: 3,
    neuroticism: 4,
    coping_style: "support_seeking",
    coping_notes: isAr
      ? "تلجأ للأصدقاء ثم تنسحب"
      : "Reaches for friends then withdraws",
    humor: isAr ? "rare_soft" : "self_deprecating",
    humor_notes: isAr
      ? "نكتة خفيفة عندما تشعر بالأمان"
      : "Soft humor when she feels safe",
    trust_level: 2,
    trust_notes: isAr
      ? "بطيئة في الثقة؛ تختبر الدفء"
      : "Slow to trust; tests warmth",
    emotional_regulation: "delayed_flood",
    emotional_regulation_notes: isAr
      ? "تكبت ثم تنهار فجأة"
      : "Holds then floods",
    speech_style: isAr
      ? "جمل قصيرة باللهجة مع توقفات"
      : "Short colloquial sentences with pauses",
    vocabulary: {
      register: "everyday",
      markers: isAr ? ["تعبانة", "مش عارفة"] : ["tired", "I don't know"],
      avoids: isAr ? ["مصطلحات تشخيصية"] : ["diagnostic jargon"],
    },
    preferred_topics: isAr
      ? ["العمل", "العائلة"]
      : ["work stress", "family"],
    avoidant_topics: isAr
      ? ["الانتحار", "العلاقات الحميمة"]
      : ["suicidality", "intimacy"],
    memory_of_therapist: {
      remembers_name: true,
      remembers_prior_sessions: true,
      alliance_sensitivity: 4,
      rupture_style: isAr
        ? "تنسحب بصمت ثم تعود بحذر"
        : "Withdraws quietly then returns cautiously",
      notes: isAr
        ? "حساسة لنبرة الصوت"
        : "Sensitive to tone of voice",
    },
    treatment_expectations: isAr
      ? "تريد راحة سريعة دون أن تُدفع"
      : "Wants relief without being pushed",
  };
}

function defaultClinical(): ClinicalCore {
  return {
    disorder: "",
    age: 28,
    gender: "female",
    severity: "moderate",
    symptom_profile: [],
    disclosure_rules: [
      { topic: "suicidality", condition: "on_safety_assessment" },
    ],
    session_goals: [],
    ideal_approach: "",
    risk_profile: { suicidal_ideation: "none" },
  };
}

type FormState = {
  slug: string;
  default_locale: string;
  clinical: ClinicalCore;
  symptomsText: string;
  goalsText: string;
  disclosureTopic: string;
  disclosureCondition: ClinicalCore["disclosure_rules"][number]["condition"];
  enPersonality: AvatarPersonality;
  arPersonality: AvatarPersonality;
  enHuman: HumanPersonalityProfile;
  arHuman: HumanPersonalityProfile;
  voice_profile_id: string;
  default_disorder_id: string;
  humanLocale: "en-US" | "ar-JO";
};

function createInitialForm(): FormState {
  return {
    slug: "",
    default_locale: "en-US",
    clinical: defaultClinical(),
    symptomsText: "",
    goalsText: "",
    disclosureTopic: "suicidality",
    disclosureCondition: "on_safety_assessment",
    enPersonality: emptyLocalePersonality("en-US"),
    arPersonality: emptyLocalePersonality("ar-JO"),
    enHuman: defaultHumanPersonality("en-US", ""),
    arHuman: defaultHumanPersonality("ar-JO", ""),
    voice_profile_id: "",
    default_disorder_id: "",
    humanLocale: "en-US",
  };
}

function ensurePersonalityStubs(p: AvatarPersonality, locale: "en-US" | "ar-JO"): AvatarPersonality {
  const base = emptyLocalePersonality(locale);
  return {
    ...base,
    ...p,
    locale,
    authored_natively: true,
    never_translate: true,
    identity: { ...base.identity, ...(p.identity ?? {}) },
    speech: { ...base.speech, ...(p.speech ?? {}) },
    cultural_context: {
      ...base.cultural_context,
      ...(p.cultural_context ?? {}),
    },
    language_module: {
      ...base.language_module,
      ...(p.language_module ?? {}),
    },
    safety_module: {
      ...base.safety_module,
      ...(p.safety_module ?? {}),
    },
    voice: { ...base.voice, ...(p.voice ?? {}) },
  };
}

function buildWriteInput(form: FormState): VirtualPatientWriteInput {
  const symptoms = parseLines(form.symptomsText).map((line, i) => ({
    id: `sx_${i + 1}`,
    description: line,
    salience: "presenting" as const,
  }));
  const goals = parseLines(form.goalsText);
  const clinical: ClinicalCore = {
    ...form.clinical,
    symptom_profile: symptoms,
    session_goals: goals,
    disclosure_rules: [
      {
        topic: form.disclosureTopic.trim() || "suicidality",
        condition: form.disclosureCondition,
      },
    ],
    ideal_approach: form.clinical.ideal_approach,
    risk_profile: form.clinical.risk_profile ?? { suicidal_ideation: "none" },
  };

  const slug = form.slug.trim();
  const enHuman = {
    ...form.enHuman,
    version: 1 as const,
    locale: "en-US",
    avatar_slug: slug || form.enHuman.avatar_slug,
  };
  const arHuman = {
    ...form.arHuman,
    version: 1 as const,
    locale: "ar-JO",
    avatar_slug: slug || form.arHuman.avatar_slug,
  };

  return {
    slug,
    default_locale: form.default_locale || "en-US",
    clinical_core: clinical,
    personalities: {
      "en-US": ensurePersonalityStubs(form.enPersonality, "en-US"),
      "ar-JO": ensurePersonalityStubs(form.arPersonality, "ar-JO"),
    },
    human_personality: {
      "en-US": enHuman,
      "ar-JO": arHuman,
    },
    voice_profile_id: form.voice_profile_id || null,
    persona: {
      create: true,
      default_disorder_id: form.default_disorder_id || null,
    },
    rubric: [{ id: "alliance", label: "Alliance", weight: 1, max: 5 }],
  };
}

function applyLoadedAvatar(
  avatar: Record<string, unknown>,
  persona: { default_disorder_id?: string | null } | null,
): FormState {
  const clinical = (avatar.clinical_core as ClinicalCore | null) ?? defaultClinical();
  const personalities =
    (avatar.personalities as Partial<Record<string, AvatarPersonality>> | null) ??
    {};
  const hp =
    (avatar.human_personality as Partial<
      Record<string, HumanPersonalityProfile>
    > | null) ?? {};
  const slug = String(avatar.slug ?? "");

  return {
    slug,
    default_locale: String(avatar.default_locale ?? "en-US"),
    clinical: {
      ...defaultClinical(),
      ...clinical,
      risk_profile: clinical.risk_profile ?? { suicidal_ideation: "none" },
    },
    symptomsText: (clinical.symptom_profile ?? [])
      .map((s) => s.description)
      .join("\n"),
    goalsText: (clinical.session_goals ?? []).join("\n"),
    disclosureTopic: clinical.disclosure_rules?.[0]?.topic ?? "suicidality",
    disclosureCondition:
      clinical.disclosure_rules?.[0]?.condition ?? "on_safety_assessment",
    enPersonality: ensurePersonalityStubs(
      personalities["en-US"] ?? emptyLocalePersonality("en-US"),
      "en-US",
    ),
    arPersonality: ensurePersonalityStubs(
      personalities["ar-JO"] ?? emptyLocalePersonality("ar-JO"),
      "ar-JO",
    ),
    enHuman: {
      ...defaultHumanPersonality("en-US", slug),
      ...(hp["en-US"] ?? {}),
      version: 1,
      locale: "en-US",
    },
    arHuman: {
      ...defaultHumanPersonality("ar-JO", slug),
      ...(hp["ar-JO"] ?? {}),
      version: 1,
      locale: "ar-JO",
    },
    voice_profile_id: String(avatar.voice_profile_id ?? ""),
    default_disorder_id: String(persona?.default_disorder_id ?? ""),
    humanLocale: "en-US",
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={labelClass}>
      {label}
      {children}
    </label>
  );
}

function HumanPersonalityEditor({
  profile,
  onChange,
  locale,
}: {
  profile: HumanPersonalityProfile;
  onChange: (next: HumanPersonalityProfile) => void;
  locale: "en-US" | "ar-JO";
}) {
  const t = useTranslations("admin.avatars.wizard");
  const dir = locale === "ar-JO" ? "rtl" : "ltr";

  function set<K extends keyof HumanPersonalityProfile>(
    key: K,
    value: HumanPersonalityProfile[K],
  ) {
    onChange({ ...profile, [key]: value });
  }

  return (
    <div className="space-y-4" dir={dir}>
      <p className="text-sm text-[var(--on-surface-variant)]">
        {t("humanTraitsHint")}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("temperament")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.temperament}
            onChange={(e) => set("temperament", e.target.value)}
          />
        </Field>
        <Field label={t("speechStyle")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.speech_style}
            onChange={(e) => set("speech_style", e.target.value)}
          />
        </Field>
        <Field label={t("education")}>
          <input
            className={fieldClass}
            value={profile.education}
            onChange={(e) => set("education", e.target.value)}
          />
        </Field>
        <Field label={t("occupation")}>
          <input
            className={fieldClass}
            value={profile.occupation}
            onChange={(e) => set("occupation", e.target.value)}
          />
        </Field>
        <Field label={t("culture")}>
          <input
            className={fieldClass}
            value={profile.culture}
            onChange={(e) => set("culture", e.target.value)}
          />
        </Field>
        <Field label={t("religion")}>
          <input
            className={fieldClass}
            value={profile.religion}
            onChange={(e) => set("religion", e.target.value)}
          />
        </Field>
        <Field label={t("attachmentStyle")}>
          <select
            className={fieldClass}
            value={profile.attachment_style}
            onChange={(e) =>
              set(
                "attachment_style",
                e.target.value as HumanPersonalityProfile["attachment_style"],
              )
            }
          >
            {ATTACHMENT.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("attachmentNotes")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.attachment_notes}
            onChange={(e) => set("attachment_notes", e.target.value)}
          />
        </Field>
        <Field label={t("copingStyle")}>
          <select
            className={fieldClass}
            value={profile.coping_style}
            onChange={(e) =>
              set(
                "coping_style",
                e.target.value as HumanPersonalityProfile["coping_style"],
              )
            }
          >
            {COPING.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("copingNotes")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.coping_notes}
            onChange={(e) => set("coping_notes", e.target.value)}
          />
        </Field>
        <Field label={t("humor")}>
          <select
            className={fieldClass}
            value={profile.humor}
            onChange={(e) =>
              set("humor", e.target.value as HumanPersonalityProfile["humor"])
            }
          >
            {HUMOR.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("humorNotes")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.humor_notes}
            onChange={(e) => set("humor_notes", e.target.value)}
          />
        </Field>
        <Field label={t("emotionalRegulation")}>
          <select
            className={fieldClass}
            value={profile.emotional_regulation}
            onChange={(e) =>
              set(
                "emotional_regulation",
                e.target
                  .value as HumanPersonalityProfile["emotional_regulation"],
              )
            }
          >
            {REGULATION.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("emotionalRegulationNotes")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.emotional_regulation_notes}
            onChange={(e) => set("emotional_regulation_notes", e.target.value)}
          />
        </Field>
        <Field label={t("treatmentExpectations")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.treatment_expectations}
            onChange={(e) => set("treatment_expectations", e.target.value)}
          />
        </Field>
        <Field label={t("trustNotes")}>
          <textarea
            className={`${fieldClass} min-h-[72px]`}
            value={profile.trust_notes}
            onChange={(e) => set("trust_notes", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6">
        {(
          [
            ["resilience", t("resilience")],
            ["openness", t("openness")],
            ["agreeableness", t("agreeableness")],
            ["conscientiousness", t("conscientiousness")],
            ["neuroticism", t("neuroticism")],
            ["trust_level", t("trustLevel")],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={`${label} (1–5)`}>
            <input
              type="number"
              min={1}
              max={5}
              className={fieldClass}
              value={profile[key]}
              onChange={(e) =>
                set(
                  key,
                  Math.min(
                    5,
                    Math.max(1, Number(e.target.value) || 1),
                  ) as HumanPersonalityProfile[typeof key],
                )
              }
            />
          </Field>
        ))}
      </div>

      <AdvancedDetails title={t("humanAdvanced")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("intelBand")}>
            <select
              className={fieldClass}
              value={profile.intelligence.band}
              onChange={(e) =>
                set("intelligence", {
                  ...profile.intelligence,
                  band: e.target.value as HumanPersonalityProfile["intelligence"]["band"],
                })
              }
            >
              {["average", "above_average", "high", "very_high"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("intelStyle")}>
            <input
              className={fieldClass}
              value={profile.intelligence.style}
              onChange={(e) =>
                set("intelligence", {
                  ...profile.intelligence,
                  style: e.target.value,
                })
              }
            />
          </Field>
          <Field label={t("intelStrengths")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={linesFrom(profile.intelligence.strengths)}
              onChange={(e) =>
                set("intelligence", {
                  ...profile.intelligence,
                  strengths: parseLines(e.target.value),
                })
              }
            />
          </Field>
          <Field label={t("vocabRegister")}>
            <select
              className={fieldClass}
              value={profile.vocabulary.register}
              onChange={(e) =>
                set("vocabulary", {
                  ...profile.vocabulary,
                  register: e.target
                    .value as HumanPersonalityProfile["vocabulary"]["register"],
                })
              }
            >
              {["concrete", "everyday", "educated", "technical", "mixed"].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label={t("vocabMarkers")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={linesFrom(profile.vocabulary.markers)}
              onChange={(e) =>
                set("vocabulary", {
                  ...profile.vocabulary,
                  markers: parseLines(e.target.value),
                })
              }
            />
          </Field>
          <Field label={t("vocabAvoids")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={linesFrom(profile.vocabulary.avoids)}
              onChange={(e) =>
                set("vocabulary", {
                  ...profile.vocabulary,
                  avoids: parseLines(e.target.value),
                })
              }
            />
          </Field>
          <Field label={t("preferredTopics")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={linesFrom(profile.preferred_topics)}
              onChange={(e) => set("preferred_topics", parseLines(e.target.value))}
            />
          </Field>
          <Field label={t("avoidantTopics")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={linesFrom(profile.avoidant_topics)}
              onChange={(e) => set("avoidant_topics", parseLines(e.target.value))}
            />
          </Field>
          <Field label={t("ruptureStyle")}>
            <input
              className={fieldClass}
              value={profile.memory_of_therapist.rupture_style}
              onChange={(e) =>
                set("memory_of_therapist", {
                  ...profile.memory_of_therapist,
                  rupture_style: e.target.value,
                })
              }
            />
          </Field>
          <Field label={t("memoryNotes")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={profile.memory_of_therapist.notes}
              onChange={(e) =>
                set("memory_of_therapist", {
                  ...profile.memory_of_therapist,
                  notes: e.target.value,
                })
              }
            />
          </Field>
        </div>
      </AdvancedDetails>
    </div>
  );
}

function LocalePatientEditor({
  personality,
  onChange,
  locale,
}: {
  personality: AvatarPersonality;
  onChange: (next: AvatarPersonality) => void;
  locale: "en-US" | "ar-JO";
}) {
  const t = useTranslations("admin.avatars.wizard");
  const dir = locale === "ar-JO" ? "rtl" : "ltr";
  const id = personality.identity;

  return (
    <div className="space-y-4" dir={dir}>
      {locale === "ar-JO" ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--secondary)_35%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--secondary)_8%,transparent)] p-3 text-sm text-[var(--on-surface)]">
          {t("arabicIndependentHint")}
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("displayName")}>
          <input
            className={fieldClass}
            value={id.display_name}
            onChange={(e) =>
              onChange({
                ...personality,
                identity: { ...id, display_name: e.target.value },
              })
            }
          />
        </Field>
        <Field label={t("occupation")}>
          <input
            className={fieldClass}
            value={id.occupation}
            onChange={(e) =>
              onChange({
                ...personality,
                identity: { ...id, occupation: e.target.value },
              })
            }
          />
        </Field>
        <Field label={t("city")}>
          <input
            className={fieldClass}
            value={id.city}
            onChange={(e) =>
              onChange({
                ...personality,
                identity: { ...id, city: e.target.value },
              })
            }
          />
        </Field>
        <Field label={t("country")}>
          <input
            className={fieldClass}
            value={id.country}
            onChange={(e) =>
              onChange({
                ...personality,
                identity: { ...id, country: e.target.value },
              })
            }
          />
        </Field>
        <Field label={t("dialect")}>
          <input
            className={fieldClass}
            value={personality.dialect ?? ""}
            onChange={(e) =>
              onChange({ ...personality, dialect: e.target.value })
            }
          />
        </Field>
        <Field label={t("language")}>
          <input
            className={fieldClass}
            value={personality.language}
            onChange={(e) =>
              onChange({ ...personality, language: e.target.value })
            }
          />
        </Field>
      </div>
      <Field label={t("personaPrompt")}>
        <textarea
          className={`${fieldClass} min-h-[140px]`}
          value={personality.persona_prompt}
          onChange={(e) =>
            onChange({ ...personality, persona_prompt: e.target.value })
          }
        />
      </Field>
      <AdvancedDetails title={t("localeAdvanced")}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t("stigmaFraming")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={personality.cultural_context?.stigma_framing ?? ""}
              onChange={(e) =>
                onChange({
                  ...personality,
                  cultural_context: {
                    ...personality.cultural_context,
                    stigma_framing: e.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label={t("helpSeeking")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={personality.cultural_context?.help_seeking_attitude ?? ""}
              onChange={(e) =>
                onChange({
                  ...personality,
                  cultural_context: {
                    ...personality.cultural_context,
                    help_seeking_attitude: e.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label={t("languageDirective")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={personality.language_module?.directive ?? ""}
              onChange={(e) =>
                onChange({
                  ...personality,
                  language_module: {
                    ...personality.language_module,
                    directive: e.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label={t("sampleUtterances")}>
            <textarea
              className={`${fieldClass} min-h-[72px]`}
              value={linesFrom(personality.speech?.sample_utterances)}
              onChange={(e) =>
                onChange({
                  ...personality,
                  speech: {
                    ...personality.speech,
                    register: personality.speech?.register ?? "colloquial",
                    sample_utterances: parseLines(e.target.value),
                  },
                })
              }
            />
          </Field>
        </div>
      </AdvancedDetails>
    </div>
  );
}

function ValidationPanel({
  validation,
  publishReady,
}: {
  validation: ValidationResult | null;
  publishReady: boolean;
}) {
  const t = useTranslations("admin.avatars.wizard");
  if (!validation) {
    return (
      <p className="text-sm text-[var(--on-surface-variant)]">
        {t("validationEmpty")}
      </p>
    );
  }

  const gates = Object.entries(validation.gates);
  const errors = validation.issues.filter((i) => i.severity === "error");
  const warnings = validation.issues.filter((i) => i.severity === "warning");

  return (
    <div className="space-y-4">
      <div
        className={`rounded-lg border p-4 text-sm ${
          publishReady
            ? "border-[color-mix(in_srgb,var(--primary)_40%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
            : "border-[color-mix(in_srgb,var(--secondary)_40%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--secondary)_8%,transparent)]"
        }`}
      >
        <p className="font-semibold text-[var(--on-surface)]">
          {publishReady ? t("publishReady") : t("notPublishReady")}
        </p>
        <p className="mt-1 text-[var(--on-surface-variant)]">
          {publishReady ? t("publishReadyHint") : t("notPublishReadyHint")}
        </p>
      </div>

      <ul className="space-y-2">
        {gates.map(([key, gate]) => (
          <li
            key={key}
            className="flex items-start gap-2 text-sm text-[var(--on-surface)]"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              aria-hidden
            >
              {gate.ok ? "check_circle" : "warning"}
            </span>
            <span>
              <span className="font-medium">{gate.label}</span>
              <span className="text-[var(--on-surface-variant)]">
                {" "}
                — {gate.ok ? t("gateOk") : t("gateNeedsWork")}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {errors.length ? (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            {t("errors")}
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--on-surface)]">
            {errors.map((issue: ValidationIssue, idx) => (
              <li key={`${issue.code}-${idx}`} className="flex gap-2">
                <span className="material-symbols-outlined text-[16px] text-[var(--error)]">
                  error
                </span>
                <span>
                  {issue.message}
                  {issue.path ? (
                    <span className="text-[var(--on-surface-variant)]">
                      {" "}
                      ({issue.path})
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length ? (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
            {t("warnings")}
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-[var(--on-surface)]">
            {warnings.map((issue: ValidationIssue, idx) => (
              <li key={`${issue.code}-${idx}`} className="flex gap-2">
                <span className="material-symbols-outlined text-[16px]">
                  warning
                </span>
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AdvancedJson value={validation} title={t("rawValidationJson")} />
    </div>
  );
}

export function VirtualPatientWizard({
  voices,
  disorders: initialDisorders,
  avatarId: initialAvatarId,
}: {
  voices: WizardVoiceOption[];
  disorders: WizardDisorderOption[];
  avatarId?: string;
}) {
  const t = useTranslations("admin.avatars.wizard");
  const [step, setStep] = useState<StepId>("identity");
  const [form, setForm] = useState<FormState>(createInitialForm);
  const [avatarId, setAvatarId] = useState<string | null>(initialAvatarId ?? null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [publishReady, setPublishReady] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [preview, setPreview] = useState<unknown>(null);
  const [disorders, setDisorders] = useState(initialDisorders);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startPending] = useTransition();
  const [loadingExisting, setLoadingExisting] = useState(Boolean(initialAvatarId));

  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    if (!initialAvatarId) return;
    let cancelled = false;
    startTransition(() => {
      void (async () => {
        setError(null);
        try {
          const res = await fetch(`/api/admin/avatars/${initialAvatarId}`);
          const data = await res.json();
          if (cancelled) return;
          if (!res.ok) {
            setError(data.error ?? t("loadFailed"));
            setLoadingExisting(false);
            return;
          }
          setForm(
            applyLoadedAvatar(
              data.avatar as Record<string, unknown>,
              data.persona as { default_disorder_id?: string | null } | null,
            ),
          );
          setAvatarId(initialAvatarId);
          setSavedSlug(String(data.avatar?.slug ?? ""));
          if (data.validation) {
            setValidation(data.validation as ValidationResult);
            setPublishReady(Boolean(data.validation.publishReady));
          }
        } catch {
          if (!cancelled) setError(t("loadFailed"));
        } finally {
          if (!cancelled) setLoadingExisting(false);
        }
      })();
    });
    return () => {
      cancelled = true;
    };
  }, [initialAvatarId, t]);

  useEffect(() => {
    if (initialDisorders.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/disorders");
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setDisorders((data.disorders as WizardDisorderOption[]) ?? []);
      } catch {
        /* ignore — picker stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDisorders.length]);

  function patchForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
    setDraftSaved(false);
    setPublishReady(false);
  }

  async function runValidate() {
    setError(null);
    setMessage(null);
    const body = { ...buildWriteInput(form), mode: "publish" as const };
    try {
      const res = await fetch("/api/admin/avatars/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("validateFailed"));
        return;
      }
      setValidation(data.validation as ValidationResult);
      setPublishReady(Boolean(data.publishReady));
      setMessage(
        data.publishReady ? t("validatePassed") : t("validateNeedsWork"),
      );
      setStep("validation");
    } catch {
      setError(t("networkError"));
    }
  }

  async function runSaveDraft() {
    setError(null);
    setMessage(null);
    const body = buildWriteInput(form);
    try {
      const url = avatarId
        ? `/api/admin/avatars/${avatarId}`
        : "/api/admin/avatars";
      const res = await fetch(url, {
        method: avatarId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("saveFailed"));
        if (data.issues) {
          setValidation({
            ok: false,
            publishReady: false,
            issues: data.issues,
            gates: {},
          });
        }
        return;
      }
      const id = String(data.avatar?.id ?? avatarId ?? "");
      const slug = String(data.avatar?.slug ?? form.slug);
      setAvatarId(id);
      setSavedSlug(slug);
      setDraftSaved(true);
      if (data.validation) {
        setValidation(data.validation as ValidationResult);
        setPublishReady(Boolean(data.validation.publishReady));
      } else {
        setPublishReady(false);
      }
      setMessage(t("draftSavedDetail", { id, slug }));
      setStep("save");
    } catch {
      setError(t("networkError"));
    }
  }

  async function runPublish() {
    if (!avatarId || !publishReady) return;
    setError(null);
    setMessage(null);
    try {
      // Persist latest draft first so publish gate sees current form.
      const saveRes = await fetch(`/api/admin/avatars/${avatarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildWriteInput(form)),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        setError(saveData.error ?? t("saveFailed"));
        return;
      }

      const res = await fetch(`/api/admin/avatars/${avatarId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("publishFailed"));
        if (data.issues || data.validation?.issues) {
          setValidation({
            ok: false,
            publishReady: false,
            issues: data.issues ?? data.validation.issues,
            gates: data.validation?.gates ?? {},
          });
          setPublishReady(false);
        }
        return;
      }
      setMessage(t("publishedDetail", { slug: data.avatar?.slug ?? form.slug }));
      setStep("save");
    } catch {
      setError(t("networkError"));
    }
  }

  async function runPreview() {
    setError(null);
    if (!avatarId) {
      setError(t("previewNeedsSave"));
      return;
    }
    try {
      const res = await fetch(`/api/admin/avatars/${avatarId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: form.default_locale, includeCase: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("previewFailed"));
        return;
      }
      setPreview(data);
      setStep("preview");
    } catch {
      setError(t("networkError"));
    }
  }

  const stepLabel = (id: StepId) => {
    const map: Record<StepId, string> = {
      identity: t("stepIdentity"),
      clinical: t("stepClinical"),
      personality: t("stepPersonality"),
      english: t("stepEnglish"),
      arabic: t("stepArabic"),
      voice: t("stepVoice"),
      therapy: t("stepTherapy"),
      preview: t("stepPreview"),
      validation: t("stepValidate"),
      save: t("stepPublish"),
    };
    return map[id];
  };

  const activeVoices = voices.filter((v) => v.is_active);
  const activeDisorders = disorders.filter((d) => d.is_active);

  if (loadingExisting) {
    return (
      <div className="clinical-card p-6 text-sm text-[var(--on-surface-variant)]">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--on-surface-variant)]">{t("intro")}</p>

      <nav
        aria-label={t("stepsNav")}
        className="flex flex-wrap gap-2 border-b border-[var(--outline-variant)] pb-3"
      >
        {STEPS.map((id, i) => {
          const selected = id === step;
          return (
            <button
              key={id}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selected
                  ? "bg-[var(--surface-container)] text-[var(--primary)]"
                  : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
              }`}
              onClick={() => setStep(id)}
            >
              <span className="me-1 text-[10px] text-[var(--outline)]">
                {i + 1}.
              </span>
              {stepLabel(id)}
            </button>
          );
        })}
      </nav>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-[color-mix(in_srgb,var(--error)_40%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--error)_8%,transparent)] p-3 text-sm"
        >
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_40%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] p-3 text-sm">
          {message}
        </div>
      ) : null}

      <div className="clinical-card space-y-5 p-6">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--outline)]">
          {stepLabel(step)}
        </h2>

        {step === "identity" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t("slug")}>
              <input
                className={fieldClass}
                value={form.slug}
                onChange={(e) =>
                  patchForm({
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-"),
                  })
                }
                placeholder="maya-chen"
              />
            </Field>
            <Field label={t("defaultLocale")}>
              <select
                className={fieldClass}
                value={form.default_locale}
                onChange={(e) => patchForm({ default_locale: e.target.value })}
              >
                <option value="en-US">en-US</option>
                <option value="ar-JO">ar-JO</option>
              </select>
            </Field>
            <p className="md:col-span-2 text-sm text-[var(--on-surface-variant)]">
              {t("slugHint")}
            </p>
          </div>
        ) : null}

        {step === "clinical" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("disorder")}>
                <input
                  className={fieldClass}
                  value={form.clinical.disorder}
                  onChange={(e) =>
                    patchForm({
                      clinical: { ...form.clinical, disorder: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t("age")}>
                <input
                  type="number"
                  min={1}
                  className={fieldClass}
                  value={form.clinical.age}
                  onChange={(e) =>
                    patchForm({
                      clinical: {
                        ...form.clinical,
                        age: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              </Field>
              <Field label={t("gender")}>
                <select
                  className={fieldClass}
                  value={form.clinical.gender}
                  onChange={(e) =>
                    patchForm({
                      clinical: {
                        ...form.clinical,
                        gender: e.target
                          .value as ClinicalCore["gender"],
                      },
                    })
                  }
                >
                  {["female", "male", "non-binary", "unspecified"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("severity")}>
                <select
                  className={fieldClass}
                  value={form.clinical.severity ?? "moderate"}
                  onChange={(e) =>
                    patchForm({
                      clinical: {
                        ...form.clinical,
                        severity: e.target
                          .value as ClinicalCore["severity"],
                      },
                    })
                  }
                >
                  {["subclinical", "mild", "moderate", "severe"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("suicidalIdeation")}>
                <select
                  className={fieldClass}
                  value={form.clinical.risk_profile?.suicidal_ideation ?? "none"}
                  onChange={(e) =>
                    patchForm({
                      clinical: {
                        ...form.clinical,
                        risk_profile: {
                          ...form.clinical.risk_profile,
                          suicidal_ideation: e.target
                            .value as ClinicalCore["risk_profile"]["suicidal_ideation"],
                        },
                      },
                    })
                  }
                >
                  {[
                    "none",
                    "passive",
                    "active_no_plan",
                    "active_with_plan",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("idealApproach")}>
                <textarea
                  className={`${fieldClass} min-h-[72px]`}
                  value={form.clinical.ideal_approach}
                  onChange={(e) =>
                    patchForm({
                      clinical: {
                        ...form.clinical,
                        ideal_approach: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label={t("symptomsLines")}>
                <textarea
                  className={`${fieldClass} min-h-[100px]`}
                  value={form.symptomsText}
                  onChange={(e) => patchForm({ symptomsText: e.target.value })}
                  placeholder={t("symptomsPlaceholder")}
                />
              </Field>
              <Field label={t("goalsLines")}>
                <textarea
                  className={`${fieldClass} min-h-[100px]`}
                  value={form.goalsText}
                  onChange={(e) => patchForm({ goalsText: e.target.value })}
                  placeholder={t("goalsPlaceholder")}
                />
              </Field>
              <Field label={t("disclosureTopic")}>
                <input
                  className={fieldClass}
                  value={form.disclosureTopic}
                  onChange={(e) =>
                    patchForm({ disclosureTopic: e.target.value })
                  }
                />
              </Field>
              <Field label={t("disclosureCondition")}>
                <select
                  className={fieldClass}
                  value={form.disclosureCondition}
                  onChange={(e) =>
                    patchForm({
                      disclosureCondition: e.target
                        .value as FormState["disclosureCondition"],
                    })
                  }
                >
                  {[
                    "volunteered",
                    "on_direct_question",
                    "on_empathic_rapport",
                    "on_safety_assessment",
                    "never",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("clinicalDisorderNote")}
            </p>
          </div>
        ) : null}

        {step === "personality" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["en-US", "ar-JO"] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    form.humanLocale === loc
                      ? "bg-[var(--surface-container)] text-[var(--primary)]"
                      : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
                  }`}
                  onClick={() => patchForm({ humanLocale: loc })}
                >
                  {loc}
                </button>
              ))}
            </div>
            <HumanPersonalityEditor
              locale={form.humanLocale}
              profile={
                form.humanLocale === "en-US" ? form.enHuman : form.arHuman
              }
              onChange={(next) =>
                patchForm(
                  form.humanLocale === "en-US"
                    ? { enHuman: next }
                    : { arHuman: next },
                )
              }
            />
          </div>
        ) : null}

        {step === "english" ? (
          <LocalePatientEditor
            locale="en-US"
            personality={form.enPersonality}
            onChange={(next) => patchForm({ enPersonality: next })}
          />
        ) : null}

        {step === "arabic" ? (
          <LocalePatientEditor
            locale="ar-JO"
            personality={form.arPersonality}
            onChange={(next) => patchForm({ arPersonality: next })}
          />
        ) : null}

        {step === "voice" ? (
          <div className="space-y-3">
            <Field label={t("voiceProfile")}>
              <select
                className={fieldClass}
                value={form.voice_profile_id}
                onChange={(e) =>
                  patchForm({ voice_profile_id: e.target.value })
                }
              >
                <option value="">{t("voiceNone")}</option>
                {activeVoices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voice_name} ({v.language}
                    {v.dialect ? ` / ${v.dialect}` : ""}
                    {v.gender ? ` · ${v.gender}` : ""})
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("voiceHint")}
            </p>
            <Link href="/admin/voices" className="btn-secondary inline-flex">
              {t("manageVoices")}
            </Link>
          </div>
        ) : null}

        {step === "therapy" ? (
          <div className="space-y-3">
            <Field label={t("defaultDisorder")}>
              <select
                className={fieldClass}
                value={form.default_disorder_id}
                onChange={(e) => {
                  const id = e.target.value;
                  const d = disorders.find((x) => x.id === id);
                  patchForm({
                    default_disorder_id: id,
                    clinical: d
                      ? {
                          ...form.clinical,
                          disorder: form.clinical.disorder || d.name,
                        }
                      : form.clinical,
                  });
                }}
              >
                <option value="">{t("disorderNone")}</option>
                {activeDisorders.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.slug})
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("therapyHint")}
            </p>
          </div>
        ) : null}

        {step === "preview" ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("previewHint")}
            </p>
            <button
              type="button"
              className="btn-secondary"
              disabled={pending || !avatarId}
              onClick={() => startPending(() => void runPreview())}
            >
              {t("runPreview")}
            </button>
            {!avatarId ? (
              <p className="text-sm text-[var(--on-surface-variant)]">
                {t("previewNeedsSave")}
              </p>
            ) : null}
            {preview ? (
              <div className="space-y-3 text-sm">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                      {t("previewName")}
                    </dt>
                    <dd className="mt-1">
                      {String(
                        (preview as { resolved?: { name?: string } }).resolved
                          ?.name ?? "—",
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--outline)]">
                      {t("previewLocale")}
                    </dt>
                    <dd className="mt-1">
                      {String(
                        (preview as { locale?: string }).locale ?? "—",
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="whitespace-pre-wrap text-[var(--on-surface-variant)]">
                  {String(
                    (preview as { resolved?: { persona_prompt_excerpt?: string } })
                      .resolved?.persona_prompt_excerpt ?? "",
                  )}
                </p>
                <AdvancedJson value={preview} title={t("rawPreviewJson")} />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === "validation" ? (
          <ValidationPanel
            validation={validation}
            publishReady={publishReady}
          />
        ) : null}

        {step === "save" ? (
          <div className="space-y-4">
            {draftSaved && avatarId ? (
              <div className="rounded-lg border border-[color-mix(in_srgb,var(--primary)_40%,var(--outline-variant))] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] p-4 text-sm">
                <p className="font-semibold text-[var(--on-surface)]">
                  {t("draftSaved")}
                </p>
                <p className="mt-1 text-[var(--on-surface-variant)]">
                  {t("draftSavedDetail", {
                    id: avatarId,
                    slug: savedSlug ?? form.slug,
                  })}
                </p>
                <Link
                  href={`/admin/avatars/${avatarId}`}
                  className="mt-3 inline-flex text-[var(--primary)] underline"
                >
                  {t("openDetail")}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-[var(--on-surface-variant)]">
                {t("saveIntro")}
              </p>
            )}
            <p className="text-sm text-[var(--on-surface-variant)]">
              {publishReady ? t("canPublish") : t("mustValidateFirst")}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--outline-variant)] pt-4">
          <button
            type="button"
            className="btn-secondary"
            disabled={stepIndex === 0}
            onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)]!)}
          >
            {t("previous")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={stepIndex >= STEPS.length - 1}
            onClick={() =>
              setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)]!)
            }
          >
            {t("next")}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => startPending(() => void runSaveDraft())}
          >
            {t("saveDraft")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={pending}
            onClick={() => startPending(() => void runValidate())}
          >
            {t("validate")}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={pending || !publishReady || !avatarId}
            onClick={() => startPending(() => void runPublish())}
            title={
              !publishReady
                ? t("publishDisabledHint")
                : !avatarId
                  ? t("previewNeedsSave")
                  : undefined
            }
          >
            {t("publish")}
          </button>
          <Link href="/admin/avatars" className="btn-secondary">
            {t("back")}
          </Link>
        </div>

        <AdvancedDetails title={t("advancedTitle")}>
          <p className="mb-3 text-xs text-[var(--on-surface-variant)]">
            {t("advancedBody")}
          </p>
          <AdvancedJson
            value={buildWriteInput(form)}
            title={t("rawPayloadJson")}
          />
        </AdvancedDetails>
      </div>
    </div>
  );
}

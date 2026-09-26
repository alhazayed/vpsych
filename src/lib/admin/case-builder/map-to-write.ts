import type { VirtualPatientWriteInput } from "@/lib/admin/virtual-patient/validation";
import type { Avatar, AvatarPersonality, ClinicalCore } from "@/lib/types";
import { synthesizeHumanPersonalityFromAvatar } from "@/lib/personality-engine/defaults";
import type { GuidedCaseDraft } from "./draft";
import { slugifyDisplayName } from "./draft";

function localePersonality(
  locale: "en-US" | "ar-JO",
  opts: {
    displayName: string;
    city: string;
    country: string;
    occupation: string;
    education?: string;
    livingSituation?: string;
    familyContext?: string;
    culturalContext?: string;
    personaPrompt: string;
    sampleUtterance: string;
  },
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
      display_name: opts.displayName,
      city: opts.city,
      country: opts.country,
      occupation: opts.occupation,
      education: opts.education,
      living_situation: opts.livingSituation,
      family_context: opts.familyContext,
      socioeconomic_context: opts.culturalContext,
    },
    persona_prompt: opts.personaPrompt,
    speech: {
      register: isAr ? "colloquial" : "neutral",
      sample_utterances: [opts.sampleUtterance],
    },
    cultural_context: {
      stigma_framing: isAr ? "الوصمة موجودة" : "Stigma exists",
      help_seeking_attitude: isAr ? "مترددة" : "Hesitant",
    },
    language_module: {
      directive: isAr
        ? "تحدّثي باللهجة الأردنية الطبيعية كمريض تدريبي تخيلي."
        : "Speak natural American English as this fictional training patient.",
      fallback_replies: isAr ? ["ما بعرف"] : ["I don't know"],
    },
    safety_module: {
      crisis_resources: [{ name: "Crisis", contact: "911" }],
      risk_disclosure_style: "cautious",
      boundary_rules: [
        "Stay in character as the fictional training patient",
        "Never claim to be a real patient or provide real clinical advice",
      ],
    },
    voice: {
      stt_lang: isAr ? "ar" : "en",
      tts_lang: isAr ? "ar" : "en",
    },
  };
}

/**
 * Map an approved guided draft into Virtual Patient write input.
 * Creates a fictional training draft — never a real patient record.
 */
export function guidedDraftToWriteInput(
  draft: GuidedCaseDraft,
): VirtualPatientWriteInput {
  const slug =
    draft.slug.trim() || slugifyDisplayName(draft.profile.displayName);
  const displayName =
    draft.generated?.displayNameEn?.trim() ||
    draft.profile.displayName.trim() ||
    "Training Patient";
  const city =
    draft.generated?.cityEn?.trim() || draft.profile.city.trim() || "City";
  const country =
    draft.generated?.countryEn?.trim() ||
    draft.profile.country.trim() ||
    "Country";
  const occupation =
    draft.generated?.occupationEn?.trim() ||
    draft.profile.occupation.trim() ||
    "Occupation";

  const approachParts = [
    draft.primaryFramework
      ? `Primary training framework: ${draft.primaryFramework}.`
      : "",
    draft.supportingFrameworks.length
      ? `Supporting: ${draft.supportingFrameworks.join(", ")}.`
      : "",
    draft.frameworkRationale.trim(),
  ].filter(Boolean);

  const clinical_core: ClinicalCore = {
    disorder: draft.presentationName || "Training presentation",
    dsm5_code: draft.dsm5Code ?? undefined,
    icd11_code: draft.icd11Code ?? undefined,
    age: draft.profile.age,
    gender: draft.profile.gender,
    severity: draft.severity,
    onset_duration: draft.generated?.timeline,
    symptom_profile: draft.symptoms,
    disclosure_rules:
      draft.disclosureRules.length > 0
        ? draft.disclosureRules
        : [
            {
              topic: "presenting concerns",
              condition: "volunteered",
            },
          ],
    session_goals: draft.goals.map((g) =>
      g.custom ? `[custom] ${g.label}` : g.label,
    ),
    ideal_approach:
      approachParts.join(" ") || "Supportive collaborative interview.",
    risk_profile: draft.riskProfile,
  };

  const contextBits = [
    draft.contextNarrative.trim(),
    draft.structuredContextApproved && draft.structuredContext
      ? [
          draft.structuredContext.education &&
            `Education: ${draft.structuredContext.education}`,
          draft.structuredContext.stressors?.length
            ? `Stressors: ${draft.structuredContext.stressors.join("; ")}`
            : "",
          draft.structuredContext.familyHistory &&
            `Family history: ${draft.structuredContext.familyHistory}`,
          draft.structuredContext.previousTreatment &&
            `Previous treatment: ${draft.structuredContext.previousTreatment}`,
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    draft.communicationStyle &&
      `Communication style (simulation): ${draft.communicationStyle}`,
    draft.therapeuticChallenges.length
      ? `Therapeutic challenges: ${draft.therapeuticChallenges.join(", ")}`
      : "",
    draft.sectionApprovals.generated &&
      draft.generated?.presentingComplaint &&
      `Presenting complaint: ${draft.generated.presentingComplaint}`,
    draft.sectionApprovals.generated &&
      draft.generated?.historyNarrative &&
      `History: ${draft.generated.historyNarrative}`,
    draft.sectionApprovals.generated &&
      draft.generated?.hiddenInformationNotes &&
      `Hidden information notes: ${draft.generated.hiddenInformationNotes}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const personaPromptEn = [
    `You are a fictional educational training patient named ${displayName}.`,
    `This is a training simulation — not a real patient.`,
    `Training presentation: ${clinical_core.disorder}.`,
    `Age ${clinical_core.age}, gender ${clinical_core.gender}.`,
    draft.sectionApprovals.generated
      ? draft.generated?.personaPromptEn?.trim()
      : "",
    contextBits,
    "Stay in character. Do not break character or claim to be an AI.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const personaPromptAr = [
    `أنت مريض تدريبي تخيلي للتعليم فقط — لست مريضاً حقيقياً.`,
    `عرض تدريبي: ${clinical_core.disorder}.`,
    `العمر ${clinical_core.age}.`,
    `يجب على المؤلف إكمال الشخصية العربية بشكل مستقل قبل النشر (لا تنسخ الإنجليزية).`,
  ].join("\n");

  const enPersonality = localePersonality("en-US", {
    displayName,
    city,
    country,
    occupation,
    education: draft.profile.education || undefined,
    livingSituation: draft.profile.livingSituation || undefined,
    familyContext: draft.structuredContext?.familyHistory,
    culturalContext: draft.profile.culturalContext || undefined,
    personaPrompt: personaPromptEn,
    sampleUtterance: draft.generated?.presentingComplaint
      ? draft.generated.presentingComplaint.slice(0, 160)
      : "I've been having a hard time lately.",
  });

  const arPersonality = localePersonality("ar-JO", {
    displayName: `${displayName} (مسودة عربية)`,
    city: "عمّان",
    country: "الأردن",
    occupation,
    personaPrompt: personaPromptAr,
    sampleUtterance: "صراحة تعبان الفترة هاي.",
  });

  const now = new Date().toISOString();
  const stubAvatar: Avatar = {
    id: draft.avatarId ?? "00000000-0000-4000-8000-000000000000",
    name: displayName,
    disorder: clinical_core.disorder,
    age: clinical_core.age,
    gender: clinical_core.gender,
    portrait_url: null,
    persona_prompt: personaPromptEn,
    ideal_guidelines: {
      session_goals: clinical_core.session_goals,
      ideal_approach: clinical_core.ideal_approach,
    },
    rubric: [],
    is_active: false,
    created_at: now,
    updated_at: now,
    slug,
    clinical_core,
  };

  const enHp = synthesizeHumanPersonalityFromAvatar({
    avatar: stubAvatar,
    personality: enPersonality,
    locale: "en-US",
  });
  const arHp = synthesizeHumanPersonalityFromAvatar({
    avatar: stubAvatar,
    personality: arPersonality,
    locale: "ar-JO",
  });

  return {
    slug,
    default_locale: "en-US",
    clinical_core,
    personalities: {
      "en-US": enPersonality,
      "ar-JO": arPersonality,
    },
    human_personality: {
      "en-US": { ...enHp, locale: "en-US", avatar_slug: slug },
      "ar-JO": { ...arHp, locale: "ar-JO", avatar_slug: slug },
    },
    rubric: [
      {
        id: "alliance",
        label: "Alliance",
        weight: 1,
        max: 5,
      },
    ],
    ideal_guidelines: {
      case_type: "training_simulation",
      session_goals: clinical_core.session_goals,
      ideal_approach: clinical_core.ideal_approach,
      primary_framework: draft.primaryFramework,
      supporting_frameworks: draft.supportingFrameworks,
      communication_style: draft.communicationStyle,
      therapeutic_challenges: draft.therapeuticChallenges,
    },
    voice_profile_id: draft.voiceProfileId,
    persona: {
      create: true,
      default_disorder_id: draft.presentationId,
      default_disorder_slug: draft.presentationSlug,
      display_name: displayName,
      slug,
      identity: {
        age: clinical_core.age,
        gender: clinical_core.gender,
        occupation_baseline: occupation,
        education_baseline: draft.profile.education || undefined,
        culture_baseline: draft.profile.culturalContext || undefined,
        communication_style: draft.communicationStyle ?? undefined,
      },
    },
  };
}

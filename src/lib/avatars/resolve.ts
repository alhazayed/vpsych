import {
  assemblePerTurnReinforcement,
  assembleSystemPrompt,
  synthesizePromptInputFromFlat,
} from "@/lib/ai/prompt-engine";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { isCaseSnapshot } from "@/lib/case-engine/persist";
import type {
  Avatar,
  AvatarPersonality,
  ClinicalCore,
  ResolvedAvatar,
  RubricItem,
} from "@/lib/types";
import { DEFAULT_AVATAR_LOCALE } from "@/lib/types";
import { projectAvatarVoiceFields } from "@/lib/voice/registry";

export type ResolveAvatarOptions = {
  /** Immutable CaseInstance snapshot — diagnosis comes from here, not the avatar. */
  caseSnapshot?: CaseInstanceSnapshot | null;
};

const LOCALE_ALIASES: Record<string, string> = {
  en: "en-US",
  "en-us": "en-US",
  "en-US": "en-US",
  ar: "ar-JO",
  "ar-jo": "ar-JO",
  "ar-JO": "ar-JO",
  "ar-sa": "ar-JO",
  "ar-ae": "ar-JO",
  "ar-eg": "ar-JO",
};

/** Normalize UI / profile / session language tags to avatar personality locales. */
export function normalizeAvatarLocale(
  input?: string | null,
  fallback: string = DEFAULT_AVATAR_LOCALE,
): string {
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  const aliased = LOCALE_ALIASES[trimmed] ?? LOCALE_ALIASES[trimmed.toLowerCase()];
  if (aliased) return aliased;
  if (/^[a-z]{2}(-[A-Z]{2})?$/i.test(trimmed)) {
    const [lang, region] = trimmed.split("-");
    if (!region) {
      return normalizeAvatarLocale(lang, fallback);
    }
    return `${lang!.toLowerCase()}-${region.toUpperCase()}`;
  }
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("ar")) return "ar-JO";
  if (lower.startsWith("en")) return "en-US";
  return fallback;
}

function isPersonality(
  value: AvatarPersonality | null | undefined,
): value is AvatarPersonality {
  return Boolean(value && value.identity && value.persona_prompt);
}

export function pickPersonality(
  avatar: Avatar,
  requestedLocale?: string | null,
): { locale: string; personality: AvatarPersonality } | null {
  const personalities = avatar.personalities;
  if (!personalities || typeof personalities !== "object") return null;

  const defaultLocale = normalizeAvatarLocale(
    avatar.default_locale,
    DEFAULT_AVATAR_LOCALE,
  );
  const wanted = normalizeAvatarLocale(requestedLocale, defaultLocale);

  const direct = personalities[wanted];
  if (isPersonality(direct) && direct.is_active !== false) {
    return { locale: wanted, personality: direct };
  }

  const lang = wanted.split("-")[0]!;
  for (const [key, value] of Object.entries(personalities)) {
    if (
      isPersonality(value) &&
      value.is_active !== false &&
      (key === lang || key.startsWith(`${lang}-`) || value.language === lang)
    ) {
      return { locale: key, personality: value };
    }
  }

  const fallback = personalities[defaultLocale];
  if (isPersonality(fallback) && fallback.is_active !== false) {
    return { locale: defaultLocale, personality: fallback };
  }

  for (const [key, value] of Object.entries(personalities)) {
    if (isPersonality(value) && value.is_active !== false) {
      return { locale: key, personality: value };
    }
  }

  return null;
}

function localizeRubric(
  rubric: RubricItem[] | null | undefined,
  labels?: Record<string, string> | null,
): RubricItem[] {
  const items = rubric ?? [];
  if (!labels) return items;
  return items.map((item) => ({
    ...item,
    label: labels[item.id] ?? item.label,
  }));
}

function guidelinesFromCore(
  core: ClinicalCore | null | undefined,
  avatar: Avatar,
) {
  if (core) {
    return {
      session_goals: core.session_goals,
      ideal_approach: core.ideal_approach,
    };
  }
  return avatar.ideal_guidelines ?? {};
}

/**
 * Resolve an avatar row into a locale-specific runtime projection.
 * System prompt is assembled by the multilingual prompt engine (Modules 1–4).
 * v1 rows (no personalities) synthesize a compatible prompt input from flat columns.
 *
 * When `options.caseSnapshot` is present (Dynamic Clinical Case Engine), diagnosis
 * and clinical_core come from the immutable CaseInstance — the persona identity
 * remains on the avatar/personality.
 */
export function resolveAvatar(
  avatar: Avatar,
  requestedLocale?: string | null,
  options?: ResolveAvatarOptions,
): ResolvedAvatar {
  const snapshot =
    options?.caseSnapshot && isCaseSnapshot(options.caseSnapshot)
      ? options.caseSnapshot
      : null;
  const localeHint = snapshot?.locale ?? requestedLocale;

  const picked =
    (avatar.schema_version ?? 1) >= 2
      ? pickPersonality(avatar, localeHint)
      : null;

  if (picked) {
    const { locale, personality } = picked;
    const core: ClinicalCore =
      snapshot?.clinical_core ??
      avatar.clinical_core ??
      synthesizePromptInputFromFlat({
        name: personality.identity.display_name,
        disorder: avatar.disorder,
        age: avatar.age,
        gender: avatar.gender,
        persona_prompt: personality.persona_prompt,
        dialect: personality.dialect,
        locale,
        sessionGoals: avatar.ideal_guidelines?.session_goals,
        idealApproach: avatar.ideal_guidelines?.ideal_approach,
      }).clinical_core;

    // Preserve persona demographics from the avatar clinical core when a case
    // snapshot overrides diagnosis/presentation only. Identity age/gender live
    // on clinical_core (personalities do not carry numeric demographics).
    const mergedCore: ClinicalCore = snapshot
      ? {
          ...core,
          age: avatar.clinical_core?.age ?? core.age,
          gender: avatar.clinical_core?.gender ?? core.gender,
        }
      : core;

    const assembly = {
      clinical_core: mergedCore,
      personality,
      session: { locale },
    };

    // Registry (voice_profile) wins; personality.voice.voice_id / flat columns fall back.
    const registryVoice = projectAvatarVoiceFields(avatar);
    const personalityVoiceId = personality.voice.voice_id ?? null;

    return {
      id: avatar.id,
      schema_version: avatar.schema_version ?? 2,
      locale,
      language: personality.language,
      direction: personality.direction,
      name: personality.identity.display_name,
      disorder: mergedCore.disorder ?? avatar.disorder,
      age: mergedCore.age ?? avatar.age,
      gender: mergedCore.gender ?? avatar.gender,
      portrait_url:
        personality.identity.portrait_url ?? avatar.portrait_url ?? null,
      persona_prompt: personality.persona_prompt,
      system_prompt: assembleSystemPrompt(assembly),
      ideal_guidelines: guidelinesFromCore(mergedCore, avatar),
      rubric: localizeRubric(
        snapshot?.rubric ?? avatar.rubric,
        personality.rubric_labels,
      ),
      dialect: personality.dialect ?? null,
      voice_profile_id: registryVoice.voice_profile_id,
      voice_profile: registryVoice.voice_profile,
      voice_id:
        registryVoice.voice_id ??
        (personality.language !== "ar" ? personalityVoiceId : null) ??
        avatar.voice_id ??
        null,
      voice_id_ar:
        registryVoice.voice_id_ar ??
        (personality.language === "ar" ? personalityVoiceId : null) ??
        avatar.voice_id_ar ??
        null,
      stt_lang: personality.voice.stt_lang,
      tts_lang: personality.voice.tts_lang,
      tts_rate: personality.voice.rate,
      fallback_replies:
        personality.language_module.fallback_replies?.filter(Boolean) ?? [],
      per_turn_reinforcement: assemblePerTurnReinforcement(assembly),
      personality,
      clinical_core: mergedCore,
    };
  }

  // v1 / flat-column fallback — fully backward compatible
  const locale = normalizeAvatarLocale(
    localeHint ?? avatar.language,
    DEFAULT_AVATAR_LOCALE,
  );
  const language = locale.startsWith("ar") ? "ar" : "en";
  const flatDisorder = snapshot?.clinical_core.disorder ?? avatar.disorder;
  const assembly = synthesizePromptInputFromFlat({
    name: avatar.name,
    disorder: flatDisorder,
    age: snapshot?.clinical_core.age ?? avatar.age,
    gender: snapshot?.clinical_core.gender ?? avatar.gender,
    persona_prompt: avatar.persona_prompt,
    dialect: avatar.dialect,
    locale,
    sessionGoals:
      snapshot?.clinical_core.session_goals ??
      avatar.ideal_guidelines?.session_goals,
    idealApproach:
      snapshot?.clinical_core.ideal_approach ??
      avatar.ideal_guidelines?.ideal_approach,
  });
  if (snapshot?.clinical_core) {
    assembly.clinical_core = snapshot.clinical_core;
  }

  const registryVoice = projectAvatarVoiceFields(avatar);

  return {
    id: avatar.id,
    schema_version: avatar.schema_version ?? 1,
    locale,
    language,
    direction: language === "ar" ? "rtl" : "ltr",
    name: avatar.name,
    disorder: flatDisorder,
    age: snapshot?.clinical_core.age ?? avatar.age,
    gender: snapshot?.clinical_core.gender ?? avatar.gender,
    portrait_url: avatar.portrait_url,
    persona_prompt: avatar.persona_prompt,
    system_prompt: assembleSystemPrompt(assembly),
    ideal_guidelines: guidelinesFromCore(
      snapshot?.clinical_core ?? avatar.clinical_core,
      avatar,
    ),
    rubric: snapshot?.rubric ?? avatar.rubric ?? [],
    dialect: avatar.dialect ?? null,
    voice_profile_id: registryVoice.voice_profile_id,
    voice_profile: registryVoice.voice_profile,
    voice_id: registryVoice.voice_id,
    voice_id_ar: registryVoice.voice_id_ar,
    stt_lang: language === "ar" ? "ar-JO" : "en-US",
    tts_lang: language === "ar" ? "ar-SA" : "en-US",
    fallback_replies: [],
    per_turn_reinforcement: assemblePerTurnReinforcement(assembly),
    clinical_core:
      snapshot?.clinical_core ?? avatar.clinical_core ?? assembly.clinical_core,
    personality: assembly.personality,
  };
}

export function listAvailableLocales(avatar: Avatar): string[] {
  if ((avatar.schema_version ?? 1) >= 2 && avatar.personalities) {
    return Object.entries(avatar.personalities)
      .filter(([, p]) => isPersonality(p) && p.is_active !== false)
      .map(([key]) => key);
  }
  return [normalizeAvatarLocale(avatar.default_locale ?? avatar.language)];
}

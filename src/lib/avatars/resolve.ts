import type {
  Avatar,
  AvatarPersonality,
  ClinicalCore,
  ResolvedAvatar,
  RubricItem,
} from "@/lib/types";
import { DEFAULT_AVATAR_LOCALE } from "@/lib/types";

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

/** Normalize UI / profile language tags to avatar personality locales. */
export function normalizeAvatarLocale(
  input?: string | null,
  fallback: string = DEFAULT_AVATAR_LOCALE,
): string {
  if (!input) return fallback;
  const trimmed = input.trim();
  if (!trimmed) return fallback;
  const aliased = LOCALE_ALIASES[trimmed] ?? LOCALE_ALIASES[trimmed.toLowerCase()];
  if (aliased) return aliased;
  // Accept well-formed BCP-47 language[-REGION]
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(trimmed)) return trimmed;
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

  const lang = wanted.split("-")[0];
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

function guidelinesFromCore(core: ClinicalCore | null | undefined, avatar: Avatar) {
  if (core) {
    return {
      session_goals: core.session_goals,
      ideal_approach: core.ideal_approach,
    };
  }
  return avatar.ideal_guidelines ?? {};
}

function buildSystemPrompt(
  avatar: Avatar,
  personality: AvatarPersonality,
  core: ClinicalCore | null | undefined,
): string {
  const disorder = core?.disorder ?? avatar.disorder;
  const goals = (core?.session_goals ?? avatar.ideal_guidelines?.session_goals ?? [])
    .join("; ");
  const approach =
    core?.ideal_approach ?? avatar.ideal_guidelines?.ideal_approach ?? "";
  const boundaries = personality.safety_module.boundary_rules.join("\n- ");
  const reinforcement = personality.language_module.per_turn_reinforcement
    ? `\nTurn reminder: ${personality.language_module.per_turn_reinforcement}`
    : "";
  const codeSwitch = personality.language_module.on_therapist_code_switch
    ? `\nIf the therapist switches language: ${personality.language_module.on_therapist_code_switch}`
    : "";
  const risk = core?.risk_profile
    ? `\nRisk profile: suicidal_ideation=${core.risk_profile.suicidal_ideation}; self_harm=${Boolean(core.risk_profile.self_harm)}; harm_to_others=${Boolean(core.risk_profile.harm_to_others)}.`
    : "";
  const disclosure =
    core?.disclosure_rules?.length
      ? `\nDisclosure rules:\n${core.disclosure_rules
          .map((r) => `- ${r.topic}: ${r.condition}${r.notes ? ` (${r.notes})` : ""}`)
          .join("\n")}`
      : "";

  return `${personality.persona_prompt}

${personality.language_module.directive}
${reinforcement}${codeSwitch}

Clinical presentation (language-neutral; express only through this personality):
- Disorder: ${disorder}
- Ideal approach for the therapist trainee: ${approach}
- Session goals the trainee should pursue: ${goals}${risk}${disclosure}

Safety overrides (highest priority):
- ${boundaries}
${personality.safety_module.escalation_language ? `- Escalation language: ${personality.safety_module.escalation_language}` : ""}
- Crisis resources for this locale: ${personality.safety_module.crisis_resources
    .map((c) => `${c.name} ${c.contact}`)
    .join("; ")}

Hard rules:
- authored_natively=${personality.authored_natively}; never_translate=${personality.never_translate}
- Generate ONLY in ${personality.language} (${personality.locale}); direction=${personality.direction}
- Stay in patient role as ${personality.identity.display_name}. Never coach the therapist.`;
}

/**
 * Resolve an avatar row into a locale-specific runtime projection.
 * v1 rows (no personalities) use flat columns and default to en-US.
 */
export function resolveAvatar(
  avatar: Avatar,
  requestedLocale?: string | null,
): ResolvedAvatar {
  const picked =
    (avatar.schema_version ?? 1) >= 2
      ? pickPersonality(avatar, requestedLocale)
      : null;

  if (picked) {
    const { locale, personality } = picked;
    const core = avatar.clinical_core ?? null;
    return {
      id: avatar.id,
      schema_version: avatar.schema_version ?? 2,
      locale,
      language: personality.language,
      direction: personality.direction,
      name: personality.identity.display_name,
      disorder: core?.disorder ?? avatar.disorder,
      age: core?.age ?? avatar.age,
      gender: core?.gender ?? avatar.gender,
      portrait_url:
        personality.identity.portrait_url ?? avatar.portrait_url ?? null,
      persona_prompt: personality.persona_prompt,
      system_prompt: buildSystemPrompt(avatar, personality, core),
      ideal_guidelines: guidelinesFromCore(core, avatar),
      rubric: localizeRubric(avatar.rubric, personality.rubric_labels),
      dialect: personality.dialect ?? null,
      voice_id: personality.voice.voice_id ?? avatar.voice_id ?? null,
      stt_lang: personality.voice.stt_lang,
      tts_lang: personality.voice.tts_lang,
      tts_rate: personality.voice.rate,
      fallback_replies:
        personality.language_module.fallback_replies?.filter(Boolean) ?? [],
      per_turn_reinforcement:
        personality.language_module.per_turn_reinforcement,
      personality,
      clinical_core: core,
    };
  }

  // v1 / flat-column fallback — fully backward compatible
  const locale = normalizeAvatarLocale(
    requestedLocale ?? avatar.language,
    DEFAULT_AVATAR_LOCALE,
  );
  const language = locale.startsWith("ar") ? "ar" : "en";

  return {
    id: avatar.id,
    schema_version: avatar.schema_version ?? 1,
    locale,
    language,
    direction: language === "ar" ? "rtl" : "ltr",
    name: avatar.name,
    disorder: avatar.disorder,
    age: avatar.age,
    gender: avatar.gender,
    portrait_url: avatar.portrait_url,
    persona_prompt: avatar.persona_prompt,
    system_prompt: `${avatar.persona_prompt}

Additional constraints for this voice therapy simulation:
- Reply as the patient only. Never narrate stage directions.
- Keep replies under 80 words so they can be spoken aloud.
- Disorder context: ${avatar.disorder}.`,
    ideal_guidelines: avatar.ideal_guidelines ?? {},
    rubric: avatar.rubric ?? [],
    dialect: avatar.dialect ?? null,
    voice_id: avatar.voice_id ?? null,
    stt_lang: language === "ar" ? "ar-JO" : "en-US",
    tts_lang: language === "ar" ? "ar-SA" : "en-US",
    fallback_replies: [],
    clinical_core: avatar.clinical_core ?? null,
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

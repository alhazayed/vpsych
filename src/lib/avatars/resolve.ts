import {
  assemblePerTurnReinforcement,
  assembleSystemPrompt,
  synthesizePromptInputFromFlat,
  type PromptFidelityHints,
} from "@/lib/ai/prompt-engine";
import type { CaseInstanceSnapshot } from "@/lib/case-engine/types";
import { isCaseSnapshot } from "@/lib/case-engine/persist";
import {
  formatDifficultyBehaviorForPrompt,
  formatSpeechBehaviorForPrompt,
  speechBehaviorForDisorder,
} from "@/lib/case-engine/speech-behavior";
import {
  formatTherapyProcessForPrompt,
  formatTherapyReactionForPrompt,
} from "@/lib/case-engine/therapy-process";
import { formatAuthoredTherapyCuesForPrompt } from "@/lib/case-engine/authored-therapy-cues";
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
  /**
   * Mission 8 — preformatted Patient Adaptation Engine expression block for
   * THIS therapist turn (rapport / trust / withdrawal / anger / disclosure).
   */
  adaptationBlock?: string | null;
};

/** Avatar slug → default disorder slug when no case override is applied. */
const AVATAR_DEFAULT_DISORDER_SLUG: Record<string, string> = {
  "maya-chen": "mdd-recurrent-moderate",
  "jordan-hale": "gad-with-panic",
};

/**
 * True when the session case diagnosis differs from the avatar's authored
 * default syndrome (Case Engine invariant: persona ≠ permanent diagnosis).
 */
export function isCaseDiagnosisOverride(
  avatar: Avatar,
  snapshot: CaseInstanceSnapshot,
): boolean {
  const caseSlug = snapshot.primary_diagnosis?.slug;
  if (!caseSlug) return false;
  if (avatar.slug && AVATAR_DEFAULT_DISORDER_SLUG[avatar.slug]) {
    return AVATAR_DEFAULT_DISORDER_SLUG[avatar.slug] !== caseSlug;
  }
  const caseName = (snapshot.clinical_core?.disorder || "").toLowerCase();
  const avatarDis = (avatar.disorder || "").toLowerCase();
  if (!caseName || !avatarDis) return Boolean(caseSlug);
  const avatarKey = avatarDis.split(",")[0]?.trim() ?? avatarDis;
  return !caseName.includes(avatarKey.slice(0, 18)) && !avatarKey.includes(caseName.slice(0, 18));
}

/**
 * Remove authored "how you are right now" blocks that lock the persona to its
 * default syndrome (e.g. Maya MDD hypersomnia). Identity stays.
 * EN + AR section headers from natively authored personas.
 */
export function stripPersonaCurrentStateBlock(prompt: string): string {
  let out = prompt;
  out = out.replace(
    /\nHOW YOU ARE RIGHT NOW\n[\s\S]*?(?=\n(?:HOW YOU TALK|WHAT YOU DO AND DO NOT SAY|HOW YOU RESPOND TO THE THERAPIST)\n)/,
    "\n",
  );
  out = out.replace(
    /\nكيف حالك هلأ\n[\s\S]*?(?=\n(?:كيف بتحكي|شو بتحكي وشو ما بتحكي|كيف بتردّي على المعالج)\n)/,
    "\n",
  );
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * On diagnosis override, also strip default-syndrome HOW YOU TALK / DO-DONT
 * blocks so Module 1 speech profile is not fought by Maya MDD / Jordan GAD prose.
 */
export function stripPersonaSyndromeSpeechBlocks(prompt: string): string {
  let out = stripPersonaCurrentStateBlock(prompt);
  out = out.replace(
    /\nHOW YOU TALK\n[\s\S]*?(?=\n(?:WHAT YOU DO AND DO NOT SAY|HOW YOU RESPOND TO THE THERAPIST)\n|$)/,
    "\n",
  );
  out = out.replace(
    /\nWHAT YOU DO AND DO NOT SAY\n[\s\S]*?(?=\n(?:HOW YOU RESPOND TO THE THERAPIST)\n|$)/,
    "\n",
  );
  out = out.replace(
    /\nكيف بتحكي\n[\s\S]*?(?=\n(?:شو بتحكي وشو ما بتحكي|كيف بتردّي على المعالج)\n|$)/,
    "\n",
  );
  out = out.replace(
    /\nشو بتحكي وشو ما بتحكي\n[\s\S]*?(?=\n(?:كيف بتردّي على المعالج)\n|$)/,
    "\n",
  );
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function fidelityHintsFromSnapshot(
  snapshot: CaseInstanceSnapshot | null,
  opts?: {
    disorderHint?: string | null;
    avatarSlug?: string | null;
    locale?: string | null;
    /** When true, skip authored default-syndrome SP cues (Module 1 owns phenotype). */
    diagnosisOverride?: boolean;
  },
): PromptFidelityHints {
  const slug = snapshot?.primary_diagnosis?.slug ?? null;
  const profile = speechBehaviorForDisorder(slug, null);
  const teachingCue = snapshot?.clinical_teaching?.speech_behavior_cue?.trim();
  const speech =
    teachingCue && teachingCue.length > 40
      ? teachingCue
      : formatSpeechBehaviorForPrompt(profile);
  const mods = snapshot?.difficulty_modifiers;
  const processCue = formatTherapyProcessForPrompt(
    slug ?? opts?.disorderHint ?? null,
    null,
  );
  const reactionCue = formatTherapyReactionForPrompt(
    snapshot?.therapy_reaction_rules ?? null,
  );
  // CB-HCF-006: authored Maya/Jordan therapy_behaviour — only on default syndrome.
  const authored =
    !opts?.diagnosisOverride
      ? formatAuthoredTherapyCuesForPrompt(
          opts?.avatarSlug,
          opts?.locale ?? snapshot?.locale,
        )
      : "";
  const therapy_process_cue = [processCue, reactionCue, authored]
    .filter((s) => Boolean(s?.trim()))
    .join("\n\n");
  return {
    speech_behavior_cue: speech,
    difficulty_behavior: mods
      ? formatDifficultyBehaviorForPrompt(mods)
      : undefined,
    therapy_process_cue,
  };
}

/** Map avatar disorder string → speech/therapy slug when no case snapshot. */
function slugHintFromDisorderName(disorder?: string | null): string | null {
  if (!disorder) return null;
  const d = disorder.toLowerCase();
  if (/major depressive|mdd|depress/.test(d)) return "mdd-recurrent-moderate";
  if (/generalized anxiety|gad/.test(d)) return "gad-with-panic";
  if (/mania|bipolar/.test(d)) return "bipolar-mania";
  if (/schizo/.test(d)) return "schizophrenia";
  if (/complex.?ptsd|cptsd/.test(d)) return "complex-ptsd";
  if (/ptsd|trauma/.test(d)) return "ptsd";
  if (/borderline|bpd/.test(d)) return "bpd";
  if (/alcohol|substance/.test(d)) return "alcohol-use-disorder";
  if (/adhd|attention/.test(d)) return "adult-adhd";
  if (/panic/.test(d)) return "panic-disorder";
  if (/delirium/.test(d)) return "delirium";
  return null;
}

const MANIA_OR_PSYCHOSIS = new Set([
  "bipolar-mania",
  "schizophrenia",
  "schizoaffective",
]);

/**
 * On diagnosis override, strip syndrome-bound personality overlays that fight
 * Module 1 (MDD idioms during mania/psychosis) and append a current-state
 * override block. Identity / culture / dialect are preserved.
 */
export function adaptPersonalityForCaseSnapshot(
  personality: AvatarPersonality,
  snapshot: CaseInstanceSnapshot,
  avatar: Avatar,
): AvatarPersonality {
  if (!isCaseDiagnosisOverride(avatar, snapshot)) return personality;

  const symptomIds = new Set(
    (snapshot.clinical_core?.symptom_profile ?? []).map((s) => s.id),
  );
  const presenting = (snapshot.clinical_core?.symptom_profile ?? [])
    .filter((s) => s.salience === "presenting")
    .map((s) => s.description);
  const slug = snapshot.primary_diagnosis?.slug ?? "";
  const speechProfile = speechBehaviorForDisorder(slug, null);
  const pace =
    speechProfile.pace === "pressured"
      ? "fast"
      : speechProfile.pace === "slow" ||
          speechProfile.pace === "measured" ||
          speechProfile.pace === "fast" ||
          speechProfile.pace === "variable"
        ? speechProfile.pace
        : personality.speech?.pace;

  const strippedPrompt = stripPersonaSyndromeSpeechBlocks(
    personality.persona_prompt,
  );
  const overrideBlock = [
    "",
    "CURRENT STATE FOR THIS SESSION (sole authority for mood, sleep, energy, psychosis, speech):",
    ...presenting.map((d) => `- ${d}`),
    "Keep your identity, biography, culture, and dialect.",
    MANIA_OR_PSYCHOSIS.has(slug)
      ? "Do NOT lead with depressive hypersomnia, grey flat anhedonia, MDD fogginess, or 'haven't painted since April' — those are not this session's syndrome unless Module 1 lists them."
      : "Default-syndrome HOW YOU TALK / DO-DONT from the avatar persona do not apply — follow Module 1 speech profile.",
    "Your CURRENT SYNDROME is Module 1 only.",
  ].join("\n");

  return {
    ...personality,
    persona_prompt: `${strippedPrompt}\n${overrideBlock}`,
    clinical_localization: (personality.clinical_localization ?? []).filter(
      (row) => symptomIds.has(row.symptom_id),
    ),
    // Clear authored base-syndrome idioms; Module 1 carries phenotype language.
    idioms_of_distress: [],
    speech: {
      ...personality.speech,
      pace: pace ?? personality.speech?.pace,
      // Authored sample lines are default-syndrome; clear on any override so
      // Module 1 presentation is not primed by the wrong illness.
      sample_utterances: [],
    },
  };
}

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
    const { locale, personality: basePersonality } = picked;
    const personality = snapshot
      ? adaptPersonalityForCaseSnapshot(basePersonality, snapshot, avatar)
      : basePersonality;
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

    const fidelity = fidelityHintsFromSnapshot(snapshot, {
      disorderHint: slugHintFromDisorderName(
        mergedCore.disorder ?? avatar.disorder,
      ),
      avatarSlug: avatar.slug,
      locale,
      diagnosisOverride: snapshot
        ? isCaseDiagnosisOverride(avatar, snapshot)
        : false,
    });
    if (options?.adaptationBlock?.trim()) {
      fidelity.adaptation_block = options.adaptationBlock.trim();
    }

    const assembly = {
      clinical_core: mergedCore,
      personality,
      session: { locale },
      fidelity,
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
  assembly.fidelity = fidelityHintsFromSnapshot(snapshot, {
    disorderHint: slugHintFromDisorderName(flatDisorder),
    avatarSlug: avatar.slug,
    locale,
    diagnosisOverride: snapshot
      ? isCaseDiagnosisOverride(avatar, snapshot)
      : false,
  });
  if (options?.adaptationBlock?.trim()) {
    assembly.fidelity = {
      ...assembly.fidelity,
      adaptation_block: options.adaptationBlock.trim(),
    };
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

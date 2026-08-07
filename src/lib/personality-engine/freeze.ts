import type { Avatar } from "@/lib/types";
import { getBuiltinPersonality } from "./catalog";
import { synthesizeHumanPersonalityFromAvatar } from "./defaults";
import type { HumanPersonalityMap, HumanPersonalityProfile } from "./types";
import { isHumanPersonalityProfile } from "./validation";

export type FreezePersonalityAvatar = Pick<
  Avatar,
  "id" | "name" | "disorder" | "age" | "gender" | "slug" | "human_personality"
> & {
  clinical_core?: { age?: number; gender?: string } | null;
};

/**
 * Freeze a human personality onto a CaseInstance at generation time.
 * Precedence: persona.traits map → avatar.human_personality → builtin → synthesize.
 * Deterministic — never calls GPT.
 */
export function freezeHumanPersonalityForCase(params: {
  personaSlug: string;
  locale: string;
  personaTraits?: Record<string, unknown> | null;
  avatar?: FreezePersonalityAvatar | null;
}): HumanPersonalityProfile {
  const { locale, personaSlug } = params;

  const traits = params.personaTraits ?? {};
  const fromTraitsMap = traits.human_personality;
  if (
    fromTraitsMap &&
    typeof fromTraitsMap === "object" &&
    !Array.isArray(fromTraitsMap)
  ) {
    const map = fromTraitsMap as HumanPersonalityMap;
    const direct = map[locale];
    if (isHumanPersonalityProfile(direct)) return direct;
    for (const value of Object.values(map)) {
      if (isHumanPersonalityProfile(value)) return value;
    }
  }
  if (isHumanPersonalityProfile(traits)) {
    return traits;
  }

  if (params.avatar?.human_personality) {
    const map = params.avatar.human_personality;
    const direct = map[locale];
    if (isHumanPersonalityProfile(direct)) return direct;
    for (const value of Object.values(map)) {
      if (isHumanPersonalityProfile(value)) return value;
    }
  }

  const builtin =
    getBuiltinPersonality(personaSlug, locale) ??
    (params.avatar?.slug
      ? getBuiltinPersonality(params.avatar.slug, locale)
      : null);
  if (builtin) return builtin;

  const avatarStub: Avatar = {
    id: params.avatar?.id ?? "unknown",
    name: params.avatar?.name ?? personaSlug,
    disorder: params.avatar?.disorder ?? "unspecified",
    age: params.avatar?.age ?? params.avatar?.clinical_core?.age ?? null,
    gender: params.avatar?.gender ?? null,
    portrait_url: null,
    persona_prompt: "",
    ideal_guidelines: {},
    rubric: [],
    slug: params.avatar?.slug ?? personaSlug,
    is_active: true,
    created_at: "",
    updated_at: "",
    human_personality: params.avatar?.human_personality ?? null,
  };

  return synthesizeHumanPersonalityFromAvatar({
    avatar: avatarStub,
    personality: null,
    locale,
  });
}

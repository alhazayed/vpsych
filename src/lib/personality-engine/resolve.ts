import type { Avatar, AvatarPersonality } from "@/lib/types";
import { getBuiltinPersonality } from "./catalog";
import { synthesizeHumanPersonalityFromAvatar } from "./defaults";
import type { HumanPersonalityMap, HumanPersonalityProfile } from "./types";
import { isHumanPersonalityProfile } from "./validation";

export type ResolveHumanPersonalityInput = {
  avatar: Avatar;
  locale: string;
  /** Locale AvatarPersonality when available (for synthesis fallback). */
  personality?: AvatarPersonality | null;
  /**
   * Frozen snapshot from the session case (wins when present) so traits do not
   * drift mid-session if an admin edits the avatar mid-flight.
   */
  snapshotProfile?: HumanPersonalityProfile | null;
};

function pickFromMap(
  map: HumanPersonalityMap | null | undefined,
  locale: string,
): HumanPersonalityProfile | null {
  if (!map) return null;
  const direct = map[locale];
  if (isHumanPersonalityProfile(direct)) return direct;
  const lang = locale.split("-")[0]?.toLowerCase() ?? "";
  for (const [key, value] of Object.entries(map)) {
    if (
      key.toLowerCase().startsWith(lang) &&
      isHumanPersonalityProfile(value)
    ) {
      return value;
    }
  }
  for (const value of Object.values(map)) {
    if (isHumanPersonalityProfile(value)) return value;
  }
  return null;
}

/**
 * Resolve the authoritative human personality for this avatar/locale.
 * Precedence (independent of GPT):
 * 1. Frozen session snapshot
 * 2. Persisted `avatars.human_personality` map
 * 3. Built-in catalog by avatar slug
 * 4. Deterministic synthesis from AvatarPersonality / flat fields
 */
export function resolveHumanPersonality(
  input: ResolveHumanPersonalityInput,
): HumanPersonalityProfile {
  const { avatar, locale, personality, snapshotProfile } = input;

  if (snapshotProfile && isHumanPersonalityProfile(snapshotProfile)) {
    return snapshotProfile;
  }

  const fromDb = pickFromMap(avatar.human_personality ?? null, locale);
  if (fromDb) return fromDb;

  if (avatar.slug) {
    const builtin = getBuiltinPersonality(avatar.slug, locale);
    if (builtin) return builtin;
  }

  return synthesizeHumanPersonalityFromAvatar({
    avatar,
    personality: personality ?? null,
    locale,
  });
}

/**
 * Compare two profiles for "different people" tests — key interpersonal axes.
 */
export function personalityDistinctnessScore(
  a: HumanPersonalityProfile,
  b: HumanPersonalityProfile,
): number {
  let score = 0;
  if (a.temperament !== b.temperament) score += 1;
  if (a.attachment_style !== b.attachment_style) score += 1;
  if (a.coping_style !== b.coping_style) score += 1;
  if (a.humor !== b.humor) score += 1;
  if (a.speech_style !== b.speech_style) score += 1;
  if (a.emotional_regulation !== b.emotional_regulation) score += 1;
  if (a.occupation !== b.occupation) score += 1;
  if (a.culture !== b.culture) score += 1;
  if (a.trust_level !== b.trust_level) score += 1;
  if (a.neuroticism !== b.neuroticism) score += 1;
  if (a.conscientiousness !== b.conscientiousness) score += 1;
  if (a.openness !== b.openness) score += 1;
  return score;
}

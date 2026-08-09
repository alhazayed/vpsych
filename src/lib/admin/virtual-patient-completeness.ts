import type { Avatar } from "@/lib/types";

export type VirtualPatientCompleteness = {
  hasEnPersonality: boolean;
  hasArPersonality: boolean;
  hasVoice: boolean;
  hasClinical: boolean;
  incompleteReasons: string[];
  isComplete: boolean;
};

function hasLocalePersonality(
  avatar: Pick<Avatar, "human_personality" | "personalities" | "persona_prompt">,
  locale: string,
): boolean {
  const hp = avatar.human_personality;
  if (hp && typeof hp === "object" && hp[locale]) return true;
  const personalities = avatar.personalities;
  if (personalities && typeof personalities === "object") {
    const p = personalities[locale];
    if (p && typeof p === "object") {
      const prompt = (p as { persona_prompt?: string }).persona_prompt;
      if (typeof prompt === "string" && prompt.trim()) return true;
      return true;
    }
  }
  if (locale.startsWith("en") && avatar.persona_prompt?.trim()) return true;
  return false;
}

export function assessVirtualPatientCompleteness(
  avatar: Pick<
    Avatar,
    | "human_personality"
    | "personalities"
    | "persona_prompt"
    | "voice_profile_id"
    | "voice_id"
    | "voice_id_ar"
    | "clinical_core"
    | "disorder"
  >,
): VirtualPatientCompleteness {
  const hasEnPersonality =
    hasLocalePersonality(avatar, "en-US") ||
    hasLocalePersonality(avatar, "en");
  const hasArPersonality =
    hasLocalePersonality(avatar, "ar-JO") ||
    hasLocalePersonality(avatar, "ar");
  const hasVoice = Boolean(
    avatar.voice_profile_id || avatar.voice_id || avatar.voice_id_ar,
  );
  const hasClinical = Boolean(
    avatar.disorder?.trim() ||
      (avatar.clinical_core &&
        typeof avatar.clinical_core === "object" &&
        Object.keys(avatar.clinical_core).length > 0),
  );

  const incompleteReasons: string[] = [];
  if (!hasEnPersonality) incompleteReasons.push("Missing English personality");
  if (!hasArPersonality) incompleteReasons.push("Missing Arabic personality");
  if (!hasVoice) incompleteReasons.push("Voice not assigned");
  if (!hasClinical) incompleteReasons.push("Clinical profile incomplete");

  return {
    hasEnPersonality,
    hasArPersonality,
    hasVoice,
    hasClinical,
    incompleteReasons,
    isComplete: incompleteReasons.length === 0,
  };
}

export function listAvailableLocales(
  avatar: Pick<Avatar, "personalities" | "human_personality" | "available_locales" | "language">,
): string[] {
  const fromAvailable = avatar.available_locales ?? [];
  const fromPersonalities = Object.keys(avatar.personalities ?? {});
  const fromHp = Object.keys(avatar.human_personality ?? {});
  const set = new Set(
    [...fromAvailable, ...fromPersonalities, ...fromHp].filter(Boolean),
  );
  if (set.size === 0 && avatar.language) set.add(avatar.language);
  return [...set];
}

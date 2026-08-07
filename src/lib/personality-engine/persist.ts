import type { SupabaseClient } from "@supabase/supabase-js";
import type { HumanPersonalityMap, HumanPersonalityProfile } from "./types";
import { validateHumanPersonality } from "./validation";

export type PersistPersonalityResult =
  | { ok: true; map: HumanPersonalityMap }
  | { ok: false; error: string; issues?: string[] };

/**
 * Load human_personality map for an avatar (admin / resolve helpers).
 */
export async function loadAvatarHumanPersonalityMap(
  client: SupabaseClient,
  avatarId: string,
): Promise<HumanPersonalityMap | null> {
  const { data, error } = await client
    .from("avatars")
    .select("human_personality")
    .eq("id", avatarId)
    .maybeSingle();
  if (error || !data) return null;
  const map = (data as { human_personality?: HumanPersonalityMap | null })
    .human_personality;
  return map && typeof map === "object" ? map : null;
}

/**
 * Upsert one locale profile into avatars.human_personality and mirror into
 * personas.traits.human_personality for Case Engine consumers.
 */
export async function saveHumanPersonalityProfile(
  client: SupabaseClient,
  params: {
    avatarId: string;
    locale: string;
    profile: unknown;
  },
): Promise<PersistPersonalityResult> {
  const validated = validateHumanPersonality(params.profile);
  if (!validated.ok) {
    return {
      ok: false,
      error: "Invalid personality profile",
      issues: validated.issues.map((i) => `${i.path ?? i.code}: ${i.message}`),
    };
  }

  const profile: HumanPersonalityProfile = {
    ...validated.profile,
    locale: params.locale,
  };

  const existing = await loadAvatarHumanPersonalityMap(client, params.avatarId);
  const map: HumanPersonalityMap = { ...(existing ?? {}), [params.locale]: profile };

  const { error: avatarErr } = await client
    .from("avatars")
    .update({ human_personality: map, updated_at: new Date().toISOString() })
    .eq("id", params.avatarId);

  if (avatarErr) {
    return { ok: false, error: avatarErr.message };
  }

  // Best-effort mirror onto personas.traits (table may be empty for legacy).
  const { data: persona } = await client
    .from("personas")
    .select("id, traits")
    .eq("avatar_id", params.avatarId)
    .maybeSingle();

  if (persona?.id) {
    const traits =
      persona.traits && typeof persona.traits === "object"
        ? (persona.traits as Record<string, unknown>)
        : {};
    const nextTraits = {
      ...traits,
      human_personality: map,
      attachment_style: profile.attachment_style,
      temperament: profile.temperament,
    };
    await client.from("personas").update({ traits: nextTraits }).eq("id", persona.id);
  }

  return { ok: true, map };
}

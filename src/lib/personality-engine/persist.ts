import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAvatarContentMutable } from "@/lib/admin/virtual-patient/mutability";
import type { HumanPersonalityMap, HumanPersonalityProfile } from "./types";
import { validateHumanPersonality } from "./validation";

export type PersistPersonalityResult =
  | { ok: true; map: HumanPersonalityMap }
  | { ok: false; error: string; status?: number; issues?: string[] };

/**
 * Load human_personality map for an avatar (admin / resolve helpers).
 */
export async function loadAvatarHumanPersonalityMap(
  client: SupabaseClient,
  avatarId: string,
): Promise<HumanPersonalityMap | null> {
  return (await readHumanPersonalityMap(client, avatarId)).map;
}

async function readHumanPersonalityMap(
  client: SupabaseClient,
  avatarId: string,
): Promise<{ map: HumanPersonalityMap | null; error: string | null }> {
  const { data, error } = await client
    .from("avatars")
    .select("human_personality")
    .eq("id", avatarId)
    .maybeSingle();
  if (error) {
    console.warn("[personality] load failed", { avatarId, error: error.message });
    return { map: null, error: error.message };
  }
  if (!data) return { map: null, error: null };
  const map = (data as { human_personality?: HumanPersonalityMap | null })
    .human_personality;
  return { map: map && typeof map === "object" ? map : null, error: null };
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

  // Phase 10C-1 — published/archived content is immutable via side routes too.
  const mutable = await assertAvatarContentMutable(client, params.avatarId);
  if (!mutable.ok) {
    return {
      ok: false,
      error: mutable.error,
      status: mutable.status,
    };
  }

  const profile: HumanPersonalityProfile = {
    ...validated.profile,
    locale: params.locale,
  };

  // Each locale is a separately authored person. If the current map cannot be
  // read, saving one locale would delete the others, so stop here.
  const existing = await readHumanPersonalityMap(client, params.avatarId);
  if (existing.error) {
    return { ok: false, error: existing.error, status: 503 };
  }
  const map: HumanPersonalityMap = {
    ...(existing.map ?? {}),
    [params.locale]: profile,
  };

  const { error: avatarErr } = await client
    .from("avatars")
    .update({ human_personality: map, updated_at: new Date().toISOString() })
    .eq("id", params.avatarId);

  if (avatarErr) {
    return { ok: false, error: avatarErr.message };
  }

  // Best-effort mirror onto personas.traits (table may be empty for legacy).
  const { data: persona, error: personaErr } = await client
    .from("personas")
    .select("id, traits")
    .eq("avatar_id", params.avatarId)
    .maybeSingle();
  if (personaErr) {
    console.warn("[personality] persona mirror read failed; mirror not updated", {
      avatarId: params.avatarId,
      error: personaErr.message,
    });
  }

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
    const { error: mirrorErr } = await client
      .from("personas")
      .update({ traits: nextTraits })
      .eq("id", persona.id);
    if (mirrorErr) {
      console.warn("[personality] persona mirror update failed", {
        avatarId: params.avatarId,
        error: mirrorErr.message,
      });
    }
  }

  return { ok: true, map };
}

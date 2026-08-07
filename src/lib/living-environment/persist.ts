/**
 * Persist / load LivingWorld — DB preferred; in-memory fallback.
 * Best-effort: never throws to session callers when tables are missing.
 *
 * Worlds are insert-once (immutable). Re-save of the same case_instance_id
 * is a no-op when a row already exists.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLivingWorldMemory,
  putLivingWorldMemory,
} from "./memory-store";
import type { LivingWorld } from "./types";
import { LIVING_ENVIRONMENT_VERSION } from "./types";

export type PersistLivingWorldResult = {
  ok: boolean;
  world: LivingWorld;
  persisted: "database" | "memory" | "skipped";
  error?: string;
};

export function isLivingWorld(value: unknown): value is LivingWorld {
  if (!value || typeof value !== "object") return false;
  const v = value as LivingWorld;
  return (
    v.version === LIVING_ENVIRONMENT_VERSION &&
    typeof v.world_id === "string" &&
    Boolean(v.home?.city) &&
    Boolean(v.family?.members) &&
    Boolean(v.work?.title) &&
    Boolean(v.friends?.friends) &&
    Boolean(v.financial_problems?.currency) &&
    Boolean(v.medical_history) &&
    Boolean(v.daily_routine?.weekday) &&
    Boolean(v.social_media?.platforms) &&
    Boolean(v.education?.highest_level)
  );
}

/**
 * Load living world for a case instance.
 */
export async function loadLivingWorld(
  supabase: SupabaseClient | null | undefined,
  caseInstanceId: string | null | undefined,
): Promise<PersistLivingWorldResult | null> {
  if (!caseInstanceId) return null;

  const cached = getLivingWorldMemory(caseInstanceId);
  if (cached) {
    return { ok: true, world: cached, persisted: "memory" };
  }

  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("living_environments")
      .select("world")
      .eq("case_instance_id", caseInstanceId)
      .maybeSingle();

    if (error) {
      console.warn("[living-environment] load:", error.message);
      return null;
    }

    if (data?.world && isLivingWorld(data.world)) {
      const world: LivingWorld = {
        ...data.world,
        case_instance_id: caseInstanceId,
      };
      putLivingWorldMemory(world);
      return { ok: true, world, persisted: "database" };
    }
    return null;
  } catch (e) {
    console.warn(
      "[living-environment] load error:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Insert-once persist. If a row already exists, returns the existing world.
 * Always mirrors to process memory.
 */
export async function saveLivingWorld(
  supabase: SupabaseClient | null | undefined,
  world: LivingWorld,
  caseInstanceId?: string | null,
): Promise<PersistLivingWorldResult> {
  const bound: LivingWorld = {
    ...world,
    case_instance_id: caseInstanceId ?? world.case_instance_id,
  };
  putLivingWorldMemory(bound);

  if (!supabase || !bound.case_instance_id) {
    return {
      ok: true,
      world: bound,
      persisted: bound.case_instance_id ? "memory" : "skipped",
      error: bound.case_instance_id
        ? undefined
        : "no case_instance_id — memory only",
    };
  }

  try {
    const { data: existingRow, error: readErr } = await supabase
      .from("living_environments")
      .select("world")
      .eq("case_instance_id", bound.case_instance_id)
      .maybeSingle();

    if (!readErr && existingRow?.world && isLivingWorld(existingRow.world)) {
      const existing: LivingWorld = {
        ...existingRow.world,
        case_instance_id: bound.case_instance_id,
      };
      putLivingWorldMemory(existing);
      return { ok: true, world: existing, persisted: "database" };
    }

    const { error } = await supabase.from("living_environments").insert({
      case_instance_id: bound.case_instance_id,
      world_id: bound.world_id,
      locale: bound.locale,
      seed: bound.seed,
      world: bound,
    });

    if (error) {
      if (error.code === "23505") {
        const { data: again } = await supabase
          .from("living_environments")
          .select("world")
          .eq("case_instance_id", bound.case_instance_id)
          .maybeSingle();
        if (again?.world && isLivingWorld(again.world)) {
          const existing: LivingWorld = {
            ...again.world,
            case_instance_id: bound.case_instance_id,
          };
          putLivingWorldMemory(existing);
          return { ok: true, world: existing, persisted: "database" };
        }
      }
      console.warn("[living-environment] save:", error.message);
      return {
        ok: true,
        world: bound,
        persisted: "memory",
        error: error.message,
      };
    }

    return { ok: true, world: bound, persisted: "database" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[living-environment] save error:", msg);
    return { ok: true, world: bound, persisted: "memory", error: msg };
  }
}

/**
 * Embed living world into a case_memory jsonb blob without wiping other keys.
 */
export function embedLivingWorldInMemory(
  existing: Record<string, unknown> | null | undefined,
  world: LivingWorld,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    scope: (existing?.scope as string) ?? "case_instance",
    turns: existing?.turns ?? [],
    notes: existing?.notes ?? [],
    living_world: world,
    living_environment_version: LIVING_ENVIRONMENT_VERSION,
  };
}

export function extractLivingWorldFromMemory(
  memory: unknown,
): LivingWorld | null {
  if (!memory || typeof memory !== "object") return null;
  const blob = memory as { living_world?: unknown };
  return isLivingWorld(blob.living_world) ? blob.living_world : null;
}

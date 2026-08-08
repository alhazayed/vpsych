import type { Avatar } from "@/lib/types";
import {
  avatarToDraft,
  draftToAvatarRow,
  toListItem,
  uniqueDuplicateSlug,
  validateVirtualPatientDraft,
  canTransitionLifecycle,
  readLifecycle,
  type DuplicateVirtualPatientInput,
  type VirtualPatientDraft,
  type VirtualPatientLifecycle,
} from "@/lib/admin/virtual-patients";
import type { SupabaseClient } from "@supabase/supabase-js";

const AVATAR_SELECT =
  "id, name, disorder, age, gender, portrait_url, persona_prompt, ideal_guidelines, rubric, language, dialect, voice_profile_id, voice_id, voice_id_ar, schema_version, slug, default_locale, available_locales, clinical_core, personalities, human_personality, is_active, lifecycle_status, created_at, updated_at";

export async function listVirtualPatients(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("avatars")
    .select(AVATAR_SELECT)
    .order("updated_at", { ascending: false });
  if (error) return { ok: false as const, error: error.message };
  const items = ((data as Avatar[] | null) ?? []).map(toListItem);
  return { ok: true as const, items };
}

export async function getVirtualPatient(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from("avatars")
    .select(AVATAR_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Virtual patient not found" };
  const avatar = data as Avatar;
  return {
    ok: true as const,
    avatar,
    draft: avatarToDraft(avatar),
    item: toListItem(avatar),
  };
}

export async function createVirtualPatient(
  supabase: SupabaseClient,
  draft: VirtualPatientDraft,
) {
  const validation = validateVirtualPatientDraft(draft);
  if (!validation.ok) {
    return { ok: false as const, error: validation.errors.join(" "), validation };
  }
  const row = draftToAvatarRow({
    ...draft,
    lifecycleStatus: draft.lifecycleStatus ?? "draft",
  });
  const { data, error } = await supabase
    .from("avatars")
    .insert(row)
    .select(AVATAR_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message, validation };
  const avatar = data as Avatar;
  return {
    ok: true as const,
    avatar,
    draft: avatarToDraft(avatar),
    item: toListItem(avatar),
    validation,
  };
}

export async function updateVirtualPatient(
  supabase: SupabaseClient,
  id: string,
  draft: VirtualPatientDraft,
) {
  const current = await getVirtualPatient(supabase, id);
  if (!current.ok) return current;

  const lifecycle = readLifecycle(current.avatar);
  if (lifecycle === "published") {
    return {
      ok: false as const,
      error:
        "Published virtual patients cannot be edited. Duplicate to create a new draft.",
    };
  }

  const validation = validateVirtualPatientDraft(draft);
  if (!validation.ok) {
    return { ok: false as const, error: validation.errors.join(" "), validation };
  }

  const row = draftToAvatarRow(draft, {
    keepSlug: current.avatar.slug ?? undefined,
  });
  // Never allow publish via silent patch — use lifecycle endpoint.
  // After the published early-return above, lifecycle is draft|testing|archived.
  if (draft.lifecycleStatus === "published") {
    row.lifecycle_status = lifecycle;
  }

  const { data, error } = await supabase
    .from("avatars")
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(AVATAR_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message, validation };
  const avatar = data as Avatar;
  return {
    ok: true as const,
    avatar,
    draft: avatarToDraft(avatar),
    item: toListItem(avatar),
    validation,
  };
}

export async function setVirtualPatientLifecycle(
  supabase: SupabaseClient,
  id: string,
  to: VirtualPatientLifecycle,
) {
  const current = await getVirtualPatient(supabase, id);
  if (!current.ok) return current;
  const from = readLifecycle(current.avatar);
  if (!canTransitionLifecycle(from, to)) {
    return {
      ok: false as const,
      error: `Cannot move from ${from} to ${to}.`,
    };
  }
  if (to === "published") {
    const validation = validateVirtualPatientDraft(current.draft);
    if (!validation.ok) {
      return {
        ok: false as const,
        error: `Cannot publish: ${validation.errors.join(" ")}`,
        validation,
      };
    }
  }
  const { data, error } = await supabase
    .from("avatars")
    .update({
      lifecycle_status: to,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(AVATAR_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message };
  const avatar = data as Avatar;
  return {
    ok: true as const,
    avatar,
    draft: avatarToDraft(avatar),
    item: toListItem(avatar),
    from,
    to,
  };
}

export async function duplicateVirtualPatient(
  supabase: SupabaseClient,
  id: string,
  input: DuplicateVirtualPatientInput,
) {
  const current = await getVirtualPatient(supabase, id);
  if (!current.ok) return current;
  if (!input.newName.trim()) {
    return { ok: false as const, error: "New name is required." };
  }

  const draft: VirtualPatientDraft = {
    ...current.draft,
    displayName: input.newName.trim(),
    primaryDiagnosis: input.newDiagnosis?.trim() || current.draft.primaryDiagnosis,
    difficulty: input.newDifficulty ?? current.draft.difficulty,
    language: input.language ?? current.draft.language,
    dialect: input.dialect?.trim() || current.draft.dialect,
    lifecycleStatus: "draft",
  };

  const row = draftToAvatarRow(draft, {
    slug: uniqueDuplicateSlug(current.avatar.slug),
  });
  const { data, error } = await supabase
    .from("avatars")
    .insert(row)
    .select(AVATAR_SELECT)
    .single();
  if (error) return { ok: false as const, error: error.message };
  const avatar = data as Avatar;
  return {
    ok: true as const,
    avatar,
    draft: avatarToDraft(avatar),
    item: toListItem(avatar),
    sourceId: id,
  };
}

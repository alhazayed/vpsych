import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avatar, VoiceProfile } from "@/lib/types";
import {
  canTransitionLifecycle,
  createLifecycleStatus,
  duplicateLifecycleStatus,
  isActiveFromLifecycle,
  type VirtualPatientLifecycleStatus,
} from "@/lib/admin/virtual-patient-lifecycle";
import {
  assessDraftWrite,
  assessPublishReadiness,
  type PublishContext,
  type ValidationResult,
  type VirtualPatientWriteInput,
} from "./validation";
import {
  clearLegacyColumnsFromProfile,
  coerceVoiceProfile,
  legacyColumnsFromProfile,
} from "@/lib/voice/registry";

export type PersistResult =
  | {
      ok: true;
      avatarId: string;
      personaId: string | null;
      slug: string;
      lifecycleStatus: VirtualPatientLifecycleStatus;
      isActive: boolean;
      validation: ValidationResult;
    }
  | { ok: false; status: number; error: string; issues?: ValidationResult["issues"] };

function emptyValidation(publishReady = false): ValidationResult {
  return { ok: true, publishReady, issues: [], gates: {} };
}

function rpcErrorStatus(message: string): number {
  const m = message.toLowerCase();
  if (m.includes("forbidden")) return 403;
  if (m.includes("not found")) return 404;
  if (
    m.includes("already exists") ||
    m.includes("duplicate") ||
    m.includes("23505") ||
    m.includes("immutable")
  )
    return 409;
  if (
    m.includes("invalid") ||
    m.includes("required") ||
    m.includes("22023") ||
    m.includes("archived") ||
    m.includes("restored")
  )
    return 400;
  return 500;
}

export function readLifecycleStatus(
  avatar: Pick<Avatar, "lifecycle_status" | "is_active">,
): VirtualPatientLifecycleStatus {
  const raw = avatar.lifecycle_status;
  if (
    raw === "draft" ||
    raw === "testing" ||
    raw === "published" ||
    raw === "archived"
  ) {
    return raw;
  }
  return avatar.is_active ? "published" : "draft";
}

export function isEditableLifecycle(
  status: VirtualPatientLifecycleStatus,
): boolean {
  return status === "draft" || status === "testing";
}

export async function resolvePublishContext(
  supabase: SupabaseClient,
  input: VirtualPatientWriteInput,
): Promise<PublishContext> {
  const ctx: PublishContext = {
    defaultDisorderId: input.persona?.default_disorder_id ?? null,
    defaultDisorderActive: false,
  };

  if (input.voice_profile_id) {
    const { data } = await supabase
      .from("voice_profiles")
      .select("*")
      .eq("id", input.voice_profile_id)
      .maybeSingle();
    ctx.voiceProfile = (data as VoiceProfile | null) ?? null;
  }

  let disorderId = input.persona?.default_disorder_id ?? null;
  if (!disorderId && input.persona?.default_disorder_slug) {
    const { data } = await supabase
      .from("disorders")
      .select("id, is_active")
      .eq("slug", input.persona.default_disorder_slug)
      .maybeSingle();
    if (data?.id) {
      disorderId = data.id as string;
      ctx.defaultDisorderId = disorderId;
      ctx.defaultDisorderActive = Boolean(data.is_active);
    }
  } else if (disorderId) {
    const { data } = await supabase
      .from("disorders")
      .select("id, is_active")
      .eq("id", disorderId)
      .maybeSingle();
    ctx.defaultDisorderActive = Boolean(data?.is_active);
    ctx.defaultDisorderId = (data?.id as string | undefined) ?? disorderId;
  }

  return ctx;
}

function buildRpcPayload(
  input: VirtualPatientWriteInput,
  ctx: PublishContext,
): Record<string, unknown> {
  const persona =
    input.persona || ctx.defaultDisorderId
      ? {
          create: true,
          default_disorder_id:
            ctx.defaultDisorderId ?? input.persona?.default_disorder_id ?? null,
          display_name: input.persona?.display_name,
          slug: input.persona?.slug ?? input.slug,
          identity: input.persona?.identity,
          traits: input.persona?.traits,
        }
      : null;

  return {
    slug: input.slug,
    default_locale: input.default_locale ?? "en-US",
    clinical_core: input.clinical_core ?? null,
    personalities: input.personalities ?? null,
    human_personality: input.human_personality ?? {},
    rubric: input.rubric ?? [],
    ideal_guidelines: input.ideal_guidelines ?? {},
    voice_profile_id: input.voice_profile_id ?? null,
    voice_id: input.voice_id ?? null,
    voice_id_ar: input.voice_id_ar ?? null,
    persona,
  };
}

export async function createVirtualPatientDraft(
  supabase: SupabaseClient,
  input: VirtualPatientWriteInput,
): Promise<PersistResult> {
  const ctx = await resolvePublishContext(supabase, input);
  const validation = assessDraftWrite(input, ctx);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: "Invalid draft payload",
      issues: validation.issues.filter((i) => i.severity === "error"),
    };
  }

  const payload = buildRpcPayload(input, ctx);
  if (input.voice_profile_id && ctx.voiceProfile) {
    const legacy = legacyColumnsFromProfile(ctx.voiceProfile);
    payload.voice_id = legacy.voice_id ?? null;
    payload.voice_id_ar = legacy.voice_id_ar ?? null;
  }

  const { data, error } = await supabase.rpc("admin_create_virtual_patient", {
    p_payload: payload,
  });

  if (error) {
    return {
      ok: false,
      status: rpcErrorStatus(error.message),
      error: error.message,
    };
  }

  const row = data as {
    avatar_id: string;
    persona_id: string | null;
    slug: string;
    lifecycle_status?: string;
    is_active: boolean;
  };

  const lifecycleStatus = createLifecycleStatus();
  return {
    ok: true,
    avatarId: row.avatar_id,
    personaId: row.persona_id,
    slug: row.slug,
    lifecycleStatus,
    isActive: isActiveFromLifecycle(lifecycleStatus),
    validation: assessDraftWrite(input, ctx),
  };
}

export async function updateVirtualPatientDraft(
  supabase: SupabaseClient,
  avatarId: string,
  input: VirtualPatientWriteInput,
): Promise<PersistResult> {
  const { data: existing, error: loadErr } = await supabase
    .from("avatars")
    .select(
      "id, slug, is_active, lifecycle_status, voice_profile_id, voice_profile:voice_profiles(*)",
    )
    .eq("id", avatarId)
    .maybeSingle();

  if (loadErr || !existing) {
    return { ok: false, status: 404, error: "Avatar not found" };
  }

  const status = readLifecycleStatus(existing as Avatar);
  if (status === "published") {
    return {
      ok: false,
      status: 409,
      error: "Published avatars are immutable; duplicate to create a new draft",
    };
  }
  if (status === "archived") {
    return {
      ok: false,
      status: 409,
      error: "Archived avatars must be restored to draft before editing",
    };
  }

  const mergedSlug = input.slug ?? (existing.slug as string);
  const writeInput: VirtualPatientWriteInput = { ...input, slug: mergedSlug };
  const ctx = await resolvePublishContext(supabase, writeInput);
  const validation = assessDraftWrite(writeInput, ctx);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: "Invalid draft payload",
      issues: validation.issues.filter((i) => i.severity === "error"),
    };
  }

  const payload = buildRpcPayload(writeInput, ctx);
  if (writeInput.voice_profile_id && ctx.voiceProfile) {
    const legacy = legacyColumnsFromProfile(ctx.voiceProfile);
    payload.voice_id = legacy.voice_id ?? null;
    payload.voice_id_ar = legacy.voice_id_ar ?? null;
  } else if (writeInput.voice_profile_id === null) {
    const previous = coerceVoiceProfile(
      existing.voice_profile as VoiceProfile | VoiceProfile[] | null,
    );
    if (previous) {
      const cleared = clearLegacyColumnsFromProfile(previous);
      payload.voice_id = cleared.voice_id ?? null;
      payload.voice_id_ar = cleared.voice_id_ar ?? null;
    }
  }

  const { data, error } = await supabase.rpc("admin_update_virtual_patient", {
    p_avatar_id: avatarId,
    p_payload: payload,
  });

  if (error) {
    return {
      ok: false,
      status: rpcErrorStatus(error.message),
      error: error.message,
    };
  }

  const row = data as {
    avatar_id: string;
    persona_id: string | null;
    slug: string;
    lifecycle_status?: string;
    is_active: boolean;
  };

  const lifecycleStatus =
    row.lifecycle_status === "testing" ? "testing" : "draft";

  return {
    ok: true,
    avatarId: row.avatar_id,
    personaId: row.persona_id,
    slug: row.slug,
    lifecycleStatus,
    isActive: Boolean(row.is_active),
    validation: assessDraftWrite(writeInput, ctx),
  };
}

async function loadAvatarForPublishGate(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<
  | { ok: true; avatar: Avatar; persona: { id: string; default_disorder_id: string | null } | null }
  | { ok: false; status: number; error: string }
> {
  const { data: avatar, error } = await supabase
    .from("avatars")
    .select(
      "id, slug, is_active, lifecycle_status, schema_version, default_locale, clinical_core, personalities, human_personality, rubric, ideal_guidelines, voice_profile_id, voice_id, voice_id_ar, voice_profile:voice_profiles(*)",
    )
    .eq("id", avatarId)
    .maybeSingle();

  if (error || !avatar) {
    return { ok: false, status: 404, error: "Avatar not found" };
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("id, default_disorder_id")
    .eq("avatar_id", avatarId)
    .maybeSingle();

  return {
    ok: true,
    avatar: avatar as Avatar,
    persona: (persona as { id: string; default_disorder_id: string | null } | null) ?? null,
  };
}

export async function publishVirtualPatient(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<PersistResult> {
  const loaded = await loadAvatarForPublishGate(supabase, avatarId);
  if (!loaded.ok) return loaded;

  const { avatar, persona } = loaded;
  const from = readLifecycleStatus(avatar);
  if (!canTransitionLifecycle(from, "published")) {
    return {
      ok: false,
      status: 409,
      error: `Cannot publish from ${from}`,
    };
  }

  const input: VirtualPatientWriteInput = {
    slug: avatar.slug ?? undefined,
    default_locale: avatar.default_locale ?? "en-US",
    clinical_core: avatar.clinical_core,
    personalities: avatar.personalities,
    human_personality: avatar.human_personality,
    rubric: avatar.rubric,
    ideal_guidelines: avatar.ideal_guidelines,
    voice_profile_id: avatar.voice_profile_id,
    voice_id: avatar.voice_id,
    voice_id_ar: avatar.voice_id_ar,
    persona: {
      create: true,
      default_disorder_id: persona?.default_disorder_id ?? null,
    },
  };

  const ctx: PublishContext = {
    voiceProfile: coerceVoiceProfile(
      avatar.voice_profile as VoiceProfile | VoiceProfile[] | null,
    ),
    defaultDisorderId: persona?.default_disorder_id ?? null,
    defaultDisorderActive: false,
  };

  if (ctx.defaultDisorderId) {
    const { data: disorder } = await supabase
      .from("disorders")
      .select("id, is_active")
      .eq("id", ctx.defaultDisorderId)
      .maybeSingle();
    ctx.defaultDisorderActive = Boolean(disorder?.is_active);
  }

  const validation = assessPublishReadiness(input, ctx);
  if (!validation.publishReady) {
    return {
      ok: false,
      status: 400,
      error: "Publish validation failed",
      issues: validation.issues.filter((i) => i.severity === "error"),
    };
  }

  if ((avatar.schema_version ?? 1) < 2) {
    return {
      ok: false,
      status: 400,
      error: "schema_version must be 2 to publish",
      issues: [
        {
          code: "schema_version",
          message: "schema_version must be 2",
          path: "schema_version",
          severity: "error",
          gate: "runtime",
        },
      ],
    };
  }

  // Write canonical lifecycle; production trigger projects is_active=true.
  const { error: updateErr } = await supabase
    .from("avatars")
    .update({
      lifecycle_status: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", avatarId);

  if (updateErr) {
    return { ok: false, status: 500, error: updateErr.message };
  }

  if (persona?.id) {
    await supabase
      .from("personas")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", persona.id);
  }

  return {
    ok: true,
    avatarId,
    personaId: persona?.id ?? null,
    slug: avatar.slug as string,
    lifecycleStatus: "published",
    isActive: true,
    validation,
  };
}

export async function transitionVirtualPatientLifecycle(
  supabase: SupabaseClient,
  avatarId: string,
  to: VirtualPatientLifecycleStatus,
): Promise<PersistResult> {
  if (to === "published") {
    return publishVirtualPatient(supabase, avatarId);
  }

  const { data: avatar, error } = await supabase
    .from("avatars")
    .select("id, slug, is_active, lifecycle_status")
    .eq("id", avatarId)
    .maybeSingle();

  if (error || !avatar) {
    return { ok: false, status: 404, error: "Avatar not found" };
  }

  const from = readLifecycleStatus(avatar as Avatar);
  if (!canTransitionLifecycle(from, to)) {
    return {
      ok: false,
      status: 409,
      error: `Cannot move from ${from} to ${to}`,
    };
  }

  const { error: updateErr } = await supabase
    .from("avatars")
    .update({
      lifecycle_status: to,
      updated_at: new Date().toISOString(),
    })
    .eq("id", avatarId);

  if (updateErr) {
    return { ok: false, status: 500, error: updateErr.message };
  }

  const isActive = isActiveFromLifecycle(to);
  if (!isActive) {
    await supabase
      .from("personas")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("avatar_id", avatarId);
  }

  return {
    ok: true,
    avatarId,
    personaId: null,
    slug: (avatar.slug as string) ?? "",
    lifecycleStatus: to,
    isActive,
    validation: emptyValidation(false),
  };
}

/** Archive = withdraw from therapist catalog (published → archived; also draft/testing → archived). */
export async function archiveVirtualPatient(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<PersistResult> {
  return transitionVirtualPatientLifecycle(supabase, avatarId, "archived");
}

/** Restore archived → draft (not published). */
export async function restoreVirtualPatient(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<PersistResult> {
  return transitionVirtualPatientLifecycle(supabase, avatarId, "draft");
}

export async function moveVirtualPatientToTesting(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<PersistResult> {
  return transitionVirtualPatientLifecycle(supabase, avatarId, "testing");
}

/**
 * @deprecated Use archiveVirtualPatient. Kept as alias: deactivate ≡ archive.
 */
export async function deactivateVirtualPatient(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<PersistResult> {
  return archiveVirtualPatient(supabase, avatarId);
}

export async function duplicateVirtualPatient(
  supabase: SupabaseClient,
  sourceAvatarId: string,
  newSlug: string,
): Promise<PersistResult> {
  const slugCheck = assessDraftWrite({ slug: newSlug });
  if (!slugCheck.ok) {
    return {
      ok: false,
      status: 400,
      error: "Invalid slug",
      issues: slugCheck.issues.filter((i) => i.severity === "error"),
    };
  }

  const { data, error } = await supabase.rpc("admin_duplicate_virtual_patient", {
    p_source_avatar_id: sourceAvatarId,
    p_new_slug: newSlug,
  });

  if (error) {
    return {
      ok: false,
      status: rpcErrorStatus(error.message),
      error: error.message,
    };
  }

  const row = data as {
    avatar_id: string;
    persona_id: string | null;
    slug: string;
    is_active: boolean;
  };

  const lifecycleStatus = duplicateLifecycleStatus();
  return {
    ok: true,
    avatarId: row.avatar_id,
    personaId: row.persona_id,
    slug: row.slug,
    lifecycleStatus,
    isActive: isActiveFromLifecycle(lifecycleStatus),
    validation: emptyValidation(false),
  };
}

export function avatarToWriteInput(
  avatar: Avatar,
  persona?: { default_disorder_id?: string | null } | null,
): VirtualPatientWriteInput {
  return {
    slug: avatar.slug ?? undefined,
    default_locale: avatar.default_locale ?? "en-US",
    clinical_core: avatar.clinical_core ?? null,
    personalities: avatar.personalities ?? null,
    human_personality: (avatar.human_personality as Record<string, unknown>) ?? {},
    rubric: avatar.rubric,
    ideal_guidelines: avatar.ideal_guidelines,
    voice_profile_id: avatar.voice_profile_id ?? null,
    voice_id: avatar.voice_id ?? null,
    voice_id_ar: avatar.voice_id_ar ?? null,
    persona: {
      create: true,
      default_disorder_id: persona?.default_disorder_id ?? null,
    },
  };
}

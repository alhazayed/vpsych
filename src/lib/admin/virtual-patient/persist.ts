import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avatar, VoiceProfile } from "@/lib/types";
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
      isActive: boolean;
      validation: ValidationResult;
    }
  | { ok: false; status: number; error: string; issues?: ValidationResult["issues"] };

function rpcErrorStatus(message: string): number {
  const m = message.toLowerCase();
  if (m.includes("forbidden")) return 403;
  if (m.includes("not found")) return 404;
  if (m.includes("already exists") || m.includes("duplicate") || m.includes("23505"))
    return 409;
  if (m.includes("invalid") || m.includes("required") || m.includes("22023")) return 400;
  return 500;
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
          default_disorder_id: ctx.defaultDisorderId ?? input.persona?.default_disorder_id ?? null,
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

  // Sync legacy voice columns when assigning a profile.
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
    is_active: boolean;
  };

  return {
    ok: true,
    avatarId: row.avatar_id,
    personaId: row.persona_id,
    slug: row.slug,
    isActive: false,
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
    .select("id, slug, is_active, voice_profile_id, voice_profile:voice_profiles(*)")
    .eq("id", avatarId)
    .maybeSingle();

  if (loadErr || !existing) {
    return { ok: false, status: 404, error: "Avatar not found" };
  }

  if (existing.is_active) {
    return {
      ok: false,
      status: 409,
      error: "Published avatars must be deactivated before major edits",
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
    is_active: boolean;
  };

  return {
    ok: true,
    avatarId: row.avatar_id,
    personaId: row.persona_id,
    slug: row.slug,
    isActive: Boolean(row.is_active),
    validation: assessDraftWrite(writeInput, ctx),
  };
}

export async function publishVirtualPatient(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<PersistResult> {
  const { data: avatar, error } = await supabase
    .from("avatars")
    .select(
      "id, slug, is_active, schema_version, default_locale, clinical_core, personalities, human_personality, rubric, ideal_guidelines, voice_profile_id, voice_id, voice_id_ar, voice_profile:voice_profiles(*)",
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

  const { error: updateErr } = await supabase
    .from("avatars")
    .update({ is_active: true, updated_at: new Date().toISOString() })
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
    isActive: true,
    validation,
  };
}

export async function deactivateVirtualPatient(
  supabase: SupabaseClient,
  avatarId: string,
): Promise<PersistResult> {
  const { data: avatar, error } = await supabase
    .from("avatars")
    .select("id, slug, is_active")
    .eq("id", avatarId)
    .maybeSingle();

  if (error || !avatar) {
    return { ok: false, status: 404, error: "Avatar not found" };
  }

  const { error: updateErr } = await supabase
    .from("avatars")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", avatarId);

  if (updateErr) {
    return { ok: false, status: 500, error: updateErr.message };
  }

  await supabase
    .from("personas")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("avatar_id", avatarId);

  return {
    ok: true,
    avatarId,
    personaId: null,
    slug: (avatar.slug as string) ?? "",
    isActive: false,
    validation: {
      ok: true,
      publishReady: false,
      issues: [],
      gates: {},
    },
  };
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

  return {
    ok: true,
    avatarId: row.avatar_id,
    personaId: row.persona_id,
    slug: row.slug,
    isActive: false,
    validation: {
      ok: true,
      publishReady: false,
      issues: [],
      gates: {},
    },
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

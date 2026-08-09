import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  assessPublishReadiness,
  avatarToWriteInput,
  resolvePublishContext,
  updateVirtualPatientDraft,
  type VirtualPatientWriteInput,
} from "@/lib/admin/virtual-patient";
import type { Avatar } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/avatars/[id] — load avatar + persona for authoring. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.read",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-read:${user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: avatar, error } = await supabase
    .from("avatars")
    .select(
      "*, voice_profile:voice_profiles(id, voice_name, language, dialect, is_active, voice_id, provider)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !avatar) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("id, slug, display_name, default_disorder_id, identity, traits, is_active")
    .eq("avatar_id", id)
    .maybeSingle();

  const input = avatarToWriteInput(avatar as Avatar, persona);
  const ctx = await resolvePublishContext(supabase, input);
  const validation = assessPublishReadiness(input, ctx);

  return NextResponse.json({
    avatar,
    persona,
    validation,
  });
}

/** PATCH /api/admin/avatars/[id] — update draft (not publish). */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.update",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-update:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as VirtualPatientWriteInput & {
    id?: unknown;
    is_active?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
    available_locales?: unknown;
  };

  delete body.id;
  delete body.created_at;
  delete body.updated_at;
  delete body.available_locales;
  delete body.is_active;

  const result = await updateVirtualPatientDraft(supabase, id, body);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: clientSafeError(result.error, result.error),
        issues: result.issues ?? [],
      },
      { status: result.status },
    );
  }

  await logSecurityEvent({
    action: "admin.avatar.update",
    outcome: "success",
    resourceType: "avatar",
    resourceId: result.avatarId,
    metadata: { slug: result.slug },
    request,
  });

  return NextResponse.json({
    avatar: {
      id: result.avatarId,
      slug: result.slug,
      is_active: result.isActive,
      persona_id: result.personaId,
    },
    validation: result.validation,
    message: "Draft saved",
  });
}

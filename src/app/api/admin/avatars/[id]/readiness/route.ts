import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import {
  assessCaseReadinessFromAvatar,
  resolvePublishContext,
  avatarToWriteInput,
} from "@/lib/admin/virtual-patient";
import { coerceVoiceProfile } from "@/lib/voice/registry";
import type { Avatar, VoiceProfile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/avatars/[id]/readiness
 * Server-authoritative Case Readiness for Detail + Guided end.
 * Never used as a client-side authorization mechanism.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.readiness",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-readiness:${user.id}`,
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
      "id, slug, name, is_active, lifecycle_status, schema_version, default_locale, clinical_core, personalities, human_personality, rubric, ideal_guidelines, voice_profile_id, voice_id, voice_id_ar, voice_profile:voice_profiles(*)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !avatar) {
    return NextResponse.json(
      { error: clientSafeError("Avatar not found", "Avatar not found") },
      { status: 404 },
    );
  }

  const typed = avatar as unknown as Avatar;
  const { data: persona } = await supabase
    .from("personas")
    .select("id, default_disorder_id")
    .eq("avatar_id", id)
    .maybeSingle();

  const input = avatarToWriteInput(typed, persona);
  const ctx = await resolvePublishContext(supabase, input);
  if (!ctx.voiceProfile) {
    ctx.voiceProfile = coerceVoiceProfile(
      typed.voice_profile as VoiceProfile | VoiceProfile[] | null,
    );
  }

  const readiness = assessCaseReadinessFromAvatar(typed, persona, ctx);

  return NextResponse.json({
    avatarId: id,
    readiness,
  });
}

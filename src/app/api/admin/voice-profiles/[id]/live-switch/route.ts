import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  CLINICAL_EMOTIONS,
  liveSwitchVoice,
  toClinicalVoiceProfile,
} from "@/lib/clinical-voice";
import type { VoiceProfile } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: preview live emotion switching for a clinical voice profile.
 * Body: { emotion?: string, disorderSlug?: string }
 * Returns effective clinical delivery params (does not call ElevenLabs).
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.voice_profile.live_switch",
    resourceType: "voice_profile",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    emotion?: string;
    disorderSlug?: string;
  };

  const { data, error } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = toClinicalVoiceProfile(data as VoiceProfile);
  const effective = liveSwitchVoice({
    profile,
    emotion: body.emotion,
    disorderSlug: body.disorderSlug,
  });

  return NextResponse.json({
    emotions: CLINICAL_EMOTIONS,
    baseline: profile,
    effective,
  });
}

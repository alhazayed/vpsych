import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { sanitizeDbError } from "@/lib/safe-client-error";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin: enable / disable a voice profile.
 * Body: { is_active: boolean }
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.voice_profile.update",
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
    is_active?: boolean;
  };
  if (typeof body.is_active !== "boolean") {
    return NextResponse.json(
      { error: "is_active boolean required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("voice_profiles")
    .update({ is_active: body.is_active })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.warn("[admin/voice-profiles] update:", error?.message);
    return NextResponse.json(
      { error: sanitizeDbError(error?.message) || "Update failed" },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    action: "admin.voice_profile.update",
    outcome: "success",
    resourceType: "voice_profile",
    resourceId: id,
    metadata: { is_active: body.is_active },
    request,
  });

  return NextResponse.json({ voiceProfile: data });
}

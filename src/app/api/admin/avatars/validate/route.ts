import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  assessDraftWrite,
  assessPublishReadiness,
  type VirtualPatientWriteInput,
  resolvePublishContext,
} from "@/lib/admin/virtual-patient";

/** POST /api/admin/avatars/validate — validate without persisting. */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.validate",
    resourceType: "avatar",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-validate:${user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as VirtualPatientWriteInput & {
    mode?: "draft" | "publish";
  };
  const mode = body.mode === "publish" ? "publish" : "draft";
  const ctx = await resolvePublishContext(supabase, body);
  const validation =
    mode === "publish"
      ? assessPublishReadiness(body, ctx)
      : assessDraftWrite(body, ctx);

  return NextResponse.json({
    mode,
    validation,
    publishReady: assessPublishReadiness(body, ctx).publishReady,
  });
}

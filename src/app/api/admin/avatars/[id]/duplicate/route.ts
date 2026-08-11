import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { duplicateVirtualPatient } from "@/lib/admin/virtual-patient";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/avatars/[id]/duplicate — copy as inactive draft. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.duplicate",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-duplicate:${user.id}`,
    20,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  if (!body.slug?.trim()) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const result = await duplicateVirtualPatient(supabase, id, body.slug.trim());
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
    action: "admin.avatar.duplicate",
    outcome: "success",
    resourceType: "avatar",
    resourceId: result.avatarId,
    metadata: {
      slug: result.slug,
      source_avatar_id: id,
      lifecycle_status: result.lifecycleStatus,
      is_active: false,
    },
    request,
  });

  return NextResponse.json(
    {
      avatar: {
        id: result.avatarId,
        slug: result.slug,
        lifecycle_status: result.lifecycleStatus,
        is_active: false,
        persona_id: result.personaId,
      },
      message: "Duplicated as draft",
    },
    { status: 201 },
  );
}

import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { deactivateVirtualPatient } from "@/lib/admin/virtual-patient";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/avatars/[id]/deactivate — set is_active=false (not archive). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.deactivate",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-deactivate:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const result = await deactivateVirtualPatient(supabase, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: clientSafeError(result.error, result.error) },
      { status: result.status },
    );
  }

  await logSecurityEvent({
    action: "admin.avatar.deactivate",
    outcome: "success",
    resourceType: "avatar",
    resourceId: result.avatarId,
    metadata: { slug: result.slug, is_active: false },
    request,
  });

  return NextResponse.json({
    avatar: {
      id: result.avatarId,
      slug: result.slug,
      is_active: false,
    },
    message: "Deactivated",
  });
}

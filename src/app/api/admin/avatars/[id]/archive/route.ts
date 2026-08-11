import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { archiveVirtualPatient } from "@/lib/admin/virtual-patient";

type Params = { params: Promise<{ id: string }> };

/** POST /api/admin/avatars/[id]/archive — lifecycle_status=archived (non-destructive). */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.archive",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-archive:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const result = await archiveVirtualPatient(supabase, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: clientSafeError(result.error, result.error) },
      { status: result.status },
    );
  }

  await logSecurityEvent({
    action: "admin.avatar.archive",
    outcome: "success",
    resourceType: "avatar",
    resourceId: result.avatarId,
    metadata: {
      slug: result.slug,
      lifecycle_status: result.lifecycleStatus,
      is_active: false,
    },
    request,
  });

  return NextResponse.json({
    avatar: {
      id: result.avatarId,
      slug: result.slug,
      lifecycle_status: result.lifecycleStatus,
      is_active: false,
    },
    message: "Archived",
  });
}

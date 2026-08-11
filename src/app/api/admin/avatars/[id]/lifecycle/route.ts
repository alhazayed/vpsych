import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  moveVirtualPatientToTesting,
  restoreVirtualPatient,
  type VirtualPatientLifecycleStatus,
} from "@/lib/admin/virtual-patient";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/avatars/[id]/lifecycle
 * Body: { status: 'testing' | 'draft' } for testing ↔ draft transitions.
 * Prefer dedicated /publish /archive /restore for those transitions.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.lifecycle",
    resourceType: "avatar",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-lifecycle:${user.id}`,
    40,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { status?: VirtualPatientLifecycleStatus };
  try {
    body = (await request.json()) as { status?: VirtualPatientLifecycleStatus };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== "testing" && body.status !== "draft") {
    return NextResponse.json(
      {
        error:
          "Use /publish, /archive, or /restore for those transitions. This endpoint accepts status=testing|draft only.",
      },
      { status: 400 },
    );
  }

  const result =
    body.status === "testing"
      ? await moveVirtualPatientToTesting(supabase, id)
      : await restoreVirtualPatient(supabase, id);

  if (!result.ok) {
    return NextResponse.json(
      { error: clientSafeError(result.error, result.error) },
      { status: result.status },
    );
  }

  await logSecurityEvent({
    action: "admin.avatar.lifecycle",
    outcome: "success",
    resourceType: "avatar",
    resourceId: result.avatarId,
    metadata: {
      slug: result.slug,
      lifecycle_status: result.lifecycleStatus,
      is_active: result.isActive,
    },
    request,
  });

  return NextResponse.json({
    avatar: {
      id: result.avatarId,
      slug: result.slug,
      lifecycle_status: result.lifecycleStatus,
      is_active: result.isActive,
    },
    message: `Moved to ${result.lifecycleStatus}`,
  });
}

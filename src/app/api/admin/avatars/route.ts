import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  createVirtualPatientDraft,
  type VirtualPatientWriteInput,
} from "@/lib/admin/virtual-patient";

/**
 * POST /api/admin/avatars — create Virtual Patient draft (is_active=false).
 * Never trusts client id / timestamps / available_locales / contradictory flats.
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.avatar.create",
    resourceType: "avatar",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin-avatar-create:${user.id}`,
    20,
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

  // Strip client-controlled system fields.
  delete body.id;
  delete body.created_at;
  delete body.updated_at;
  delete body.available_locales;
  // Draft create never publishes.
  delete body.is_active;

  const result = await createVirtualPatientDraft(supabase, body);
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
    action: "admin.avatar.create",
    outcome: "success",
    resourceType: "avatar",
    resourceId: result.avatarId,
    metadata: {
      slug: result.slug,
      persona_id: result.personaId,
      is_active: false,
    },
    request,
  });

  return NextResponse.json(
    {
      avatar: {
        id: result.avatarId,
        slug: result.slug,
        is_active: false,
        schema_version: 2,
        persona_id: result.personaId,
      },
      validation: result.validation,
      message: "Draft saved",
    },
    { status: 201 },
  );
}

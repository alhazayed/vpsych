import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  setVirtualPatientLifecycle,
  type VirtualPatientLifecycle,
} from "@/lib/admin/virtual-patients";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.virtual_patients.lifecycle",
    resourceType: "virtual_patient",
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const limited = await rateLimit(
    `admin-vp-lifecycle:${auth.user.id}`,
    40,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { status?: VirtualPatientLifecycle };
  try {
    body = (await request.json()) as { status?: VirtualPatientLifecycle };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.status) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }

  const result = await setVirtualPatientLifecycle(
    auth.supabase,
    id,
    body.status,
  );
  if (!result.ok) {
    return NextResponse.json(
      {
        error: clientSafeError("Could not change status", result.error),
        validation: "validation" in result ? result.validation : undefined,
      },
      { status: 400 },
    );
  }

  await logSecurityEvent({
    action: "admin.virtual_patients.lifecycle",
    outcome: "success",
    resourceType: "virtual_patient",
    resourceId: id,
    metadata: { from: result.from, to: result.to },
    request,
  });

  return NextResponse.json({ item: result.item, draft: result.draft });
}

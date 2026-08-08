import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  duplicateVirtualPatient,
  type DuplicateVirtualPatientInput,
} from "@/lib/admin/virtual-patients";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.virtual_patients.duplicate",
    resourceType: "virtual_patient",
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const limited = await rateLimit(
    `admin-vp-dup:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: DuplicateVirtualPatientInput;
  try {
    body = (await request.json()) as DuplicateVirtualPatientInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await duplicateVirtualPatient(auth.supabase, id, body);
  if (!result.ok) {
    return NextResponse.json(
      { error: clientSafeError("Could not duplicate", result.error) },
      { status: 400 },
    );
  }

  await logSecurityEvent({
    action: "admin.virtual_patients.duplicate",
    outcome: "success",
    resourceType: "virtual_patient",
    resourceId: result.avatar.id,
    metadata: { sourceId: id, name: result.avatar.name },
    request,
  });

  return NextResponse.json({ item: result.item, draft: result.draft });
}

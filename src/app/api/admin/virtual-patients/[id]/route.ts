import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  getVirtualPatient,
  updateVirtualPatient,
  type VirtualPatientDraft,
} from "@/lib/admin/virtual-patients";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.virtual_patients.read",
    resourceType: "virtual_patient",
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const limited = await rateLimit(
    `admin-vp-read:${auth.user.id}`,
    120,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const result = await getVirtualPatient(auth.supabase, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: clientSafeError("Virtual patient not found", result.error) },
      { status: 404 },
    );
  }
  return NextResponse.json({
    item: result.item,
    draft: result.draft,
    slug: result.avatar.slug ?? null,
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireApiAdmin(request, {
    action: "admin.virtual_patients.update",
    resourceType: "virtual_patient",
  });
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const limited = await rateLimit(
    `admin-vp-update:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { draft?: VirtualPatientDraft };
  try {
    body = (await request.json()) as { draft?: VirtualPatientDraft };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.draft) {
    return NextResponse.json({ error: "draft required" }, { status: 400 });
  }

  const result = await updateVirtualPatient(auth.supabase, id, body.draft);
  if (!result.ok) {
    const status = /Published/.test(result.error) ? 409 : 400;
    return NextResponse.json(
      {
        error: clientSafeError("Could not update virtual patient", result.error),
        validation: "validation" in result ? result.validation : undefined,
      },
      { status },
    );
  }

  await logSecurityEvent({
    action: "admin.virtual_patients.update",
    outcome: "success",
    resourceType: "virtual_patient",
    resourceId: id,
    request,
  });

  return NextResponse.json({
    item: result.item,
    draft: result.draft,
    validation: result.validation,
  });
}

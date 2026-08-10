import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { rateLimit } from "@/lib/rate-limit";
import {
  createVirtualPatient,
  listVirtualPatients,
  type VirtualPatientDraft,
} from "@/lib/admin/virtual-patients";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.virtual_patients.list",
    resourceType: "virtual_patient",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-vp-list:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const result = await listVirtualPatients(auth.supabase);
  if (!result.ok) {
    return NextResponse.json(
      { error: clientSafeError("Failed to list virtual patients", result.error) },
      { status: 500 },
    );
  }
  return NextResponse.json({ items: result.items });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.virtual_patients.create",
    resourceType: "virtual_patient",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-vp-create:${auth.user.id}`,
    30,
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

  const result = await createVirtualPatient(auth.supabase, {
    ...body.draft,
    lifecycleStatus: body.draft.lifecycleStatus ?? "draft",
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error: clientSafeError("Could not create virtual patient", result.error),
        validation: "validation" in result ? result.validation : undefined,
      },
      { status: 400 },
    );
  }

  await logSecurityEvent({
    action: "admin.virtual_patients.create",
    outcome: "success",
    resourceType: "virtual_patient",
    resourceId: result.avatar.id,
    metadata: {
      name: result.avatar.name,
      lifecycle: result.item.status,
    },
    request,
  });

  return NextResponse.json({
    item: result.item,
    draft: result.draft,
    validation: result.validation,
  });
}

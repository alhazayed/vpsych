import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { isUuid } from "@/lib/skill-tests";
import {
  REVOKE_REASON_MAX,
  certificateWriteStatus,
  revokeCertificate,
} from "@/lib/certificate-registry";

const REVOKE_ERRORS: Record<string, string> = {
  forbidden: "Only an admin signed in with two-step login can revoke certificates.",
  already_revoked: "This certificate is already revoked.",
  not_found: "Certificate not found.",
  invalid: "The reason is too long.",
  not_set_up: "Certificate records are not set up yet.",
  failed: "The certificate could not be revoked. Try again.",
};

/** Admin revokes a certificate; /verify then reports it as revoked. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAdmin(request, {
    action: "admin.certificate.revoke",
    resourceType: "certificate",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-certificate-revoke:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { id } = await params;
  let body: { reason?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!isUuid(id) || reason.length > REVOKE_REASON_MAX) {
    return NextResponse.json(
      { error: `A certificate id and a reason of at most ${REVOKE_REASON_MAX} characters are required` },
      { status: 400 },
    );
  }

  const result = await revokeCertificate(supabase, {
    certificateId: id,
    reason: reason || null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: REVOKE_ERRORS[result.error] ?? REVOKE_ERRORS.failed, code: result.error },
      { status: certificateWriteStatus(result.error) },
    );
  }

  await logSecurityEvent({
    action: "admin.certificate.revoke",
    outcome: "success",
    resourceType: "certificate",
    resourceId: id,
    request,
  });
  return NextResponse.json({ ok: true, certificate: result.certificate });
}

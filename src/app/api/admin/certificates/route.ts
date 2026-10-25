import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { isUuid } from "@/lib/skill-tests";
import { CERTIFICATE_LIMITS, isCertificateLocale } from "@/lib/certificate-template";
import { certificateWriteStatus, issueCertificate } from "@/lib/certificate-registry";

const ISSUE_ERRORS: Record<string, string> = {
  forbidden: "Only an admin signed in with two-step login can issue certificates.",
  already_issued: "This trainee already has a certificate. Revoke it first to issue a new one.",
  not_found: "Trainee not found.",
  invalid: "Check the name and institute.",
  not_set_up: "Certificate records are not set up yet.",
  failed: "The certificate could not be issued. Try again.",
};

/** Admin records a Training Program certificate for a trainee. */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.certificate.issue",
    resourceType: "certificate",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-certificate-issue:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { userId?: unknown; recipientName?: unknown; institutionName?: unknown; locale?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const recipientName = typeof body.recipientName === "string" ? body.recipientName.trim() : "";
  const institutionName =
    typeof body.institutionName === "string" ? body.institutionName.trim() : "";
  if (
    !isUuid(body.userId) ||
    !recipientName ||
    recipientName.length > CERTIFICATE_LIMITS.recipient ||
    institutionName.length > CERTIFICATE_LIMITS.instituteName ||
    !isCertificateLocale(body.locale)
  ) {
    return NextResponse.json(
      { error: "userId, recipientName and locale (en | ar) are required" },
      { status: 400 },
    );
  }

  const result = await issueCertificate(supabase, {
    userId: body.userId,
    recipientName,
    institutionName: institutionName || null,
    locale: body.locale,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: ISSUE_ERRORS[result.error] ?? ISSUE_ERRORS.failed, code: result.error },
      { status: certificateWriteStatus(result.error) },
    );
  }

  await logSecurityEvent({
    action: "admin.certificate.issue",
    outcome: "success",
    resourceType: "certificate",
    resourceId: result.certificate.id,
    request,
  });
  return NextResponse.json({ ok: true, certificate: result.certificate });
}

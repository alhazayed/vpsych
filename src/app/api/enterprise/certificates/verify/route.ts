import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { verifyCertificateNumber } from "@/lib/certificate-registry";

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `cert-verify:${ip}`;
}

/**
 * GET /api/enterprise/certificates/verify?code=VT-XXXX-XXXX-XXXX
 * Public check of a printed certificate number. Returns only what the sheet
 * already shows.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(clientKey(request), 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const code = new URL(request.url).searchParams.get("code") ?? "";
  const supabase = await createClient();
  const result = await verifyCertificateNumber(supabase, code);
  if (result.status === "invalid") {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  if (result.status === "unavailable") {
    return NextResponse.json(
      { error: "Certificate verification is unavailable right now" },
      { status: 503 },
    );
  }
  if (result.status === "not_found") {
    return NextResponse.json({ ok: true, valid: false, reason: "not_found" });
  }
  const c = result.certificate;
  return NextResponse.json({
    ok: true,
    valid: result.status === "valid",
    reason: result.status === "revoked" ? "revoked" : undefined,
    certificate: {
      number: c.number,
      recipient_name: c.recipientName,
      institution_name: c.institutionName,
      issued_at: c.issuedAt,
      revoked: c.revoked,
      revoked_at: c.revokedAt,
      disclaimer: "Educational training certificate, not a clinical licence.",
    },
  });
}

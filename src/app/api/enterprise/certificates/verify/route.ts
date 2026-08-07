import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  listAllCertificates,
  verifyCertificate,
} from "@/lib/enterprise";

/**
 * GET /api/enterprise/certificates/verify?code=…
 * Public credential validation (QR). Returns validity + redacted metadata only.
 */
export async function GET(request: Request) {
  const limited = await rateLimit(`ent-cert-verify:ip`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim() ?? "";
    if (!code || code.length < 8) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const result = verifyCertificate(code, listAllCertificates());
    if (!result.valid || !result.certificate) {
      return NextResponse.json({
        ok: true,
        valid: false,
        reason: result.reason ?? "not_found",
      });
    }

    const c = result.certificate;
    return NextResponse.json({
      ok: true,
      valid: true,
      certificate: {
        kind: c.kind,
        title: c.title,
        issued_at: c.issued_at,
        expires_at: c.expires_at,
        organization_id: c.organization_id,
        revoked: c.revoked,
        disclaimer:
          "Educational credential. Not a clinical license. Formative only.",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: clientSafeError(
          "Certificate verification unavailable",
          e instanceof Error ? e : null,
        ),
      },
      { status: 500 },
    );
  }
}

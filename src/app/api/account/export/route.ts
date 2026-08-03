import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  anonymizeExportForResearch,
  buildSubjectExport,
} from "@/lib/compliance/dsar";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GDPR Art. 20 / FERPA-oriented subject access export.
 * GET /api/account/export?mode=full|research
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`dsar-export:${user.id}`, 10, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "research" ? "research" : "full";

  const payload = await buildSubjectExport(
    supabase,
    user.id,
    user.email ?? null,
  );
  const body =
    mode === "research" ? anonymizeExportForResearch(payload) : payload;

  await logSecurityEvent({
    action: "compliance.dsar.export",
    outcome: "success",
    resourceType: "account",
    resourceId: user.id,
    metadata: { mode },
    request,
  });

  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vpsych-export-${mode}-${user.id.slice(0, 8)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

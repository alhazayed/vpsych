import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { generateMissingReport } from "@/lib/admin/report-regenerate";

type Params = { params: Promise<{ sessionId: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/reports/[sessionId]/generate — create the report for a
 * finished learner session that has none (tab closed, expiry cron, failed
 * end request). Never overwrites an existing report.
 */
export async function POST(request: Request, { params }: Params) {
  const { sessionId } = await params;
  const auth = await requireApiAdmin(request, {
    action: "admin.report.generate",
    resourceType: "session_report",
    resourceId: sessionId,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin.report.generate:${user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const result = await generateMissingReport(supabase, sessionId);

  await logSecurityEvent({
    action: "admin.report.generate",
    outcome: result.ok ? "success" : "failure",
    resourceType: "session_report",
    resourceId: sessionId,
    metadata: result.ok
      ? { aiSource: result.aiSource, aiModel: result.aiModel }
      : { code: result.code, errorKind: result.errorKind ?? null },
    request,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status },
    );
  }
  return NextResponse.json({
    ok: true,
    reportId: result.reportId,
    aiSource: result.aiSource,
    aiModel: result.aiModel,
    overall: result.overall,
  });
}

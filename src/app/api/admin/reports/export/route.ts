import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-audit";
import { buildReportsCsv, type ReportExportRow } from "@/lib/admin/reports-csv";

const PAGE_SIZE = 1000;
/** Upper bound per export; the response says when it was reached. */
const MAX_ROWS = 10000;

/**
 * GET /api/admin/reports/export — every session report as CSV (newest first)
 * for instructors to analyse offline. Admin-only, like all report reads.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.report.export",
    resourceType: "session_report",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(
    `admin.report.export:${user.id}`,
    20,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const rows: ReportExportRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("session_reports")
      .select(
        `
        session_id,
        created_at,
        language,
        scores,
        sessions (
          started_at,
          ended_at,
          status,
          profiles ( display_name ),
          avatars ( name, disorder )
        )
      `,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, Math.min(from + PAGE_SIZE, MAX_ROWS) - 1);
    if (error) {
      console.warn("[admin-report-export] read:", error.message);
      await logSecurityEvent({
        action: "admin.report.export",
        outcome: "failure",
        resourceType: "session_report",
        metadata: { rows: rows.length },
        request,
      });
      return NextResponse.json(
        { error: "Could not load reports" },
        { status: 500 },
      );
    }
    const page = (data ?? []) as unknown as ReportExportRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  const truncated = rows.length >= MAX_ROWS;
  await logSecurityEvent({
    action: "admin.report.export",
    outcome: "success",
    resourceType: "session_report",
    metadata: { rows: rows.length, truncated },
    request,
  });

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buildReportsCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vpsych-reports-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Export-Rows": String(rows.length),
      "X-Export-Truncated": truncated ? "1" : "0",
    },
  });
}

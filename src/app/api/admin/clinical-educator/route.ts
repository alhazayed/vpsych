import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  buildClinicalEducatorDashboard,
  buildClinicalEducatorPdfPackage,
  clinicalEducatorFromAssessment,
  clinicalEducatorRubricCatalog,
  CLINICAL_EDUCATOR_RUBRIC_VERSION,
  CLINICAL_EDUCATOR_VERSION,
  type ClinicalEducatorReport,
  type ClinicalEducatorStoredRow,
} from "@/lib/clinical-educator";
import { normalizeReportLanguage } from "@/lib/ai/report-locale";
import type { ScoreEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET — Clinical Educator dashboard (dimension averages + rubric catalog).
 * Query: ?format=pdf&sessionId=… for print-ready PDF package of one report.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.clinical_educator.dashboard",
    resourceType: "session_reports",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-clinical-educator:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec ?? 60) },
      },
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const sessionId = url.searchParams.get("sessionId");
  const language = normalizeReportLanguage(
    url.searchParams.get("lang") ?? "en",
  );

  if (format === "pdf") {
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required for PDF export" },
        { status: 400 },
      );
    }
    const { data, error } = await auth.supabase
      .from("session_reports")
      .select(
        `
        session_id,
        scores,
        narrative,
        excerpts,
        language,
        created_at,
        sessions (
          language,
          profiles ( display_name ),
          avatars ( name, disorder )
        )
      `,
      )
      .eq("session_id", sessionId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: clientSafeError("Failed to load report", error) },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const scores = data.scores as {
      overall?: number;
      items?: ScoreEntry[];
      clinical_educator?: ClinicalEducatorReport;
    } | null;
    const session = data.sessions as unknown as {
      language?: string | null;
      profiles: { display_name: string } | null;
      avatars: { name: string; disorder: string } | null;
    } | null;

    const reportLang = normalizeReportLanguage(
      data.language ?? session?.language ?? language,
    );
    const educator =
      scores?.clinical_educator ??
      clinicalEducatorFromAssessment({
        items: scores?.items ?? [],
        messages: [],
        language: reportLang,
        narrative: String(data.narrative ?? ""),
        excerpts: (data.excerpts as string[]) ?? [],
        assessment_mode: "heuristic_fallback",
      });

    const pdf = buildClinicalEducatorPdfPackage(educator, {
      session_id: data.session_id,
      therapist_name: session?.profiles?.display_name ?? null,
      patient_name: session?.avatars?.name ?? null,
      disorder: session?.avatars?.disorder ?? null,
    });

    return new NextResponse(pdf.html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="clinical-educator-${sessionId.slice(0, 8)}.html"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const { data, error } = await auth.supabase
    .from("session_reports")
    .select(
      `
      session_id,
      scores,
      language,
      created_at,
      sessions (
        language,
        profiles ( display_name ),
        avatars ( name )
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Failed to load reports", error) },
      { status: 500 },
    );
  }

  const rows: ClinicalEducatorStoredRow[] = (data ?? []).map((row) => {
    const scores = row.scores as {
      overall?: number;
      items?: ScoreEntry[];
      clinical_educator?: ClinicalEducatorReport;
    } | null;
    const session = row.sessions as unknown as {
      language?: string | null;
      profiles: { display_name: string } | null;
      avatars: { name: string } | null;
    } | null;
    return {
      session_id: row.session_id,
      therapist_name: session?.profiles?.display_name ?? null,
      patient_name: session?.avatars?.name ?? null,
      language: row.language ?? session?.language ?? null,
      created_at: row.created_at,
      clinical_educator: scores?.clinical_educator ?? null,
      legacy_items: scores?.items,
      legacy_overall: scores?.overall ?? null,
    };
  });

  const dashboard = buildClinicalEducatorDashboard(rows, language);
  return NextResponse.json({
    dashboard,
    rubric: clinicalEducatorRubricCatalog(language),
    version: CLINICAL_EDUCATOR_VERSION,
    rubric_version: CLINICAL_EDUCATOR_RUBRIC_VERSION,
  });
}

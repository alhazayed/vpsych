import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildQualityLedgerOfflineCorpus,
  exportAnonymousResearchDataset,
  exportLedgerCsv,
  exportLedgerExcelPackage,
  exportLedgerJson,
  listQualityLedgers,
  type QualityLedgerEntry,
} from "@/lib/quality-ledger";

export const dynamic = "force-dynamic";

/**
 * Publication-oriented research export (W3-H4).
 * Formats: json | csv | excel | package (default anonymized research JSON).
 *
 * Includes scenario / AI / template / rubric versions, timestamps, quality
 * metrics, and reproducibility metadata from the Quality Ledger SSOT.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.research.export",
    resourceType: "research_export",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-research-export:${auth.user.id}`,
    30,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "package").toLowerCase();

  // Prefer sealed in-memory ledgers from this runtime, then offline corpus.
  // DB rows are available via /api/admin/quality-ledger?format=… once migrated.
  let entries: QualityLedgerEntry[] = listQualityLedgers({ limit: 5000 });
  let source: "memory" | "offline_corpus" = "memory";
  if (!entries.length) {
    entries = buildQualityLedgerOfflineCorpus();
    source = "offline_corpus";
  }

  const meta = {
    exported_at: new Date().toISOString(),
    format,
    source,
    n: entries.length,
    fields: [
      "scenario_version",
      "ai_model",
      "ai_model_version",
      "prompt_version",
      "template_version",
      "rubric_version",
      "timestamps",
      "quality_metrics",
      "reproducibility_metadata",
    ],
  };

  if (format === "csv") {
    return new NextResponse(exportLedgerCsv(entries), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition":
          'attachment; filename="vpsych-research-export.csv"',
        "X-Export-Source": source,
      },
    });
  }
  if (format === "json") {
    return NextResponse.json({
      meta,
      ledgers: JSON.parse(exportLedgerJson(entries)),
    });
  }
  if (format === "excel") {
    return NextResponse.json({
      meta,
      package: exportLedgerExcelPackage(entries),
    });
  }

  return NextResponse.json({
    meta,
    package: {
      format: "vpsych-research-package",
      version: "1.0.0",
      anonymized: true,
      dataset: JSON.parse(exportAnonymousResearchDataset(entries)),
    },
  });
}

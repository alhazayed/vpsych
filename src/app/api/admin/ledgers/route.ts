import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  MULTI_LEDGER_VERSION,
  buildMultiLedgerDashboard,
  exportAnonymousMultiLedger,
  exportMultiLedgerCsv,
  exportMultiLedgerJson,
  listCorrelationsMemory,
  listEducationalMemory,
  listOperationalMemory,
  replaySessionTimeline,
  seedMultiLedgerOfflineCorpus,
} from "@/lib/ledgers";
import {
  buildQualityLedgerOfflineCorpus,
  listQualityLedgers,
  type QualityLedgerEntry,
} from "@/lib/quality-ledger";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.multi_ledger.dashboard",
    resourceType: "multi_ledger",
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "dashboard";
  const sessionId = url.searchParams.get("session");

  // Prefer DB views when available
  const [opRes, eduRes, corrRes, qlRes] = await Promise.all([
    auth.supabase
      .from("operational_ledger_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    auth.supabase
      .from("educational_ledger_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    auth.supabase
      .from("ledger_correlations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000),
    auth.supabase
      .from("quality_ledgers")
      .select(
        "id, session_id, vqi, cfi, eri, avi, ale, rrs, event_type, content_hash, created_at, diagnosis_slug, language",
      )
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  let source = "database";
  let operational = (opRes.data ?? []) as ReturnType<
    typeof listOperationalMemory
  >;
  let educational = (eduRes.data ?? []) as ReturnType<
    typeof listEducationalMemory
  >;
  let correlations = (corrRes.data ?? []) as ReturnType<
    typeof listCorrelationsMemory
  >;
  let quality = (qlRes.data ?? []) as unknown as QualityLedgerEntry[];

  const dbEmpty =
    (!opRes.data?.length && !eduRes.data?.length) ||
    opRes.error ||
    eduRes.error;

  if (dbEmpty) {
    const seeded = seedMultiLedgerOfflineCorpus();
    operational = seeded.operational;
    educational = seeded.educational;
    correlations = seeded.correlations;
    quality = seeded.quality.length
      ? seeded.quality
      : buildQualityLedgerOfflineCorpus();
    source = "offline_corpus";
  } else if (!quality.length) {
    quality = listQualityLedgers({ limit: 500 });
    if (!quality.length) quality = buildQualityLedgerOfflineCorpus();
  }

  if (format === "csv") {
    return new NextResponse(
      exportMultiLedgerCsv({ operational, educational, quality }),
      {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="multi-ledger.csv"',
        },
      },
    );
  }
  if (format === "json") {
    return new NextResponse(
      exportMultiLedgerJson({
        operational,
        educational,
        quality,
        correlations,
      }),
      { headers: { "content-type": "application/json" } },
    );
  }
  if (format === "anonymous") {
    return new NextResponse(
      exportAnonymousMultiLedger(educational, quality),
      { headers: { "content-type": "application/json" } },
    );
  }

  if (sessionId) {
    return NextResponse.json({
      session_id: sessionId,
      timeline: replaySessionTimeline({
        session_id: sessionId,
        operational,
        educational,
        quality,
        correlations,
      }),
      source,
    });
  }

  const dashboard = buildMultiLedgerDashboard({
    operational,
    educational,
    quality,
    correlations,
  });

  return NextResponse.json({
    dashboard,
    platform_version: MULTI_LEDGER_VERSION,
    source,
    warning: opRes.error?.message || eduRes.error?.message,
    immutable: true,
  });
}

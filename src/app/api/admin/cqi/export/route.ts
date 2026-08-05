import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  buildResearchPackage,
  decryptText,
  flagsToCsv,
  memoryListFlags,
  memoryVaultEnabled,
  runQualityAnalyst,
  type CqiFlagRow,
} from "@/lib/cqi";
import type { EncBlob } from "@/lib/cqi/crypto";

export const dynamic = "force-dynamic";

function mapRow(r: Record<string, unknown>): CqiFlagRow {
  const enc = r.free_text_enc as EncBlob | null | undefined;
  return {
    id: String(r.id),
    created_at: String(r.created_at),
    reviewer_id: null,
    anonymous: true,
    session_id: null,
    category: r.category as CqiFlagRow["category"],
    severity: r.severity as CqiFlagRow["severity"],
    confidence: r.confidence as CqiFlagRow["confidence"],
    free_text: decryptText(String(r.free_text ?? ""), enc),
    suggested_improvement: (r.suggested_improvement as string) ?? null,
    expected_behaviour: (r.expected_behaviour as string) ?? null,
    reduces_educational_quality:
      (r.reduces_educational_quality as boolean) ?? null,
    usable_in_residency: (r.usable_in_residency as boolean) ?? null,
    scores: (r.scores as CqiFlagRow["scores"]) ?? {},
    would_recommend: (r.would_recommend as boolean) ?? null,
    annotations: (r.annotations as CqiFlagRow["annotations"]) ?? [],
    transcript_window:
      (r.transcript_window as CqiFlagRow["transcript_window"]) ?? [],
    status: (r.status as CqiFlagRow["status"]) ?? "submitted",
    cluster_id: (r.cluster_id as string) ?? null,
    fingerprint: String(r.fingerprint ?? ""),
    platform_version: (r.platform_version as string) ?? null,
    release_version: (r.release_version as string) ?? null,
    prompt_version: (r.prompt_version as string) ?? null,
    pme_version: (r.pme_version as string) ?? null,
    disorder_slug: (r.disorder_slug as string) ?? null,
    language: (r.language as string) ?? null,
    context: {},
    evidence: {},
    analyst_notes: {},
  };
}

/** GET — research export ?format=json|csv|package&redact=1 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cqi.export",
    resourceType: "cqi_export",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-cqi-export:${auth.user.id}`,
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
  const format = url.searchParams.get("format") ?? "package";
  const redact = url.searchParams.get("redact") === "1";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cqi_flags")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);

  let flags: CqiFlagRow[];
  if (error || !data) {
    if (!memoryVaultEnabled()) {
      return NextResponse.json({ error: "CQI vault unavailable" }, { status: 503 });
    }
    flags = memoryListFlags().map((f) => ({
      ...f,
      reviewer_id: null,
      session_id: null,
      anonymous: true,
      context: {},
      evidence: {},
    }));
  } else {
    flags = data.map((r) => mapRow(r as Record<string, unknown>));
  }

  const analyst = runQualityAnalyst(flags);
  const pkg = buildResearchPackage(flags, analyst, {
    redact_free_text: redact,
  });

  if (format === "csv") {
    const csv = flagsToCsv(pkg.flags);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cqi-export.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  // excel = csv with excel content type hint; true xlsx deferred
  if (format === "excel") {
    const csv = flagsToCsv(pkg.flags);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cqi-export.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(pkg, {
    headers: { "Cache-Control": "no-store" },
  });
}

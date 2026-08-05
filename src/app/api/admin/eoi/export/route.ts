import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { decryptText, type EncBlob } from "@/lib/cqi/crypto";
import {
  buildEoiResearchPackage,
  clusterOpportunities,
  eoiMemoryEnabled,
  eoiMemoryList,
  opportunitiesToCsv,
  type EoiOpportunityRow,
} from "@/lib/eoi";

export const dynamic = "force-dynamic";

function mapRow(r: Record<string, unknown>): EoiOpportunityRow {
  const enc = r.idea_text_enc as EncBlob | null | undefined;
  return {
    id: String(r.id),
    created_at: String(r.created_at),
    reviewer_id: null,
    anonymous: true,
    session_id: null,
    opportunity_type: r.opportunity_type as EoiOpportunityRow["opportunity_type"],
    educational_impact: Number(r.educational_impact ?? 3),
    target_learners: (r.target_learners as string[]) ?? [],
    competencies: (r.competencies as string[]) ?? [],
    idea_text: decryptText(String(r.idea_text ?? ""), enc),
    design_sketch: null,
    expected_learning_experience: null,
    annotations: [],
    transcript_window: [],
    status: (r.status as EoiOpportunityRow["status"]) ?? "open",
    cluster_id: null,
    fingerprint: String(r.fingerprint ?? ""),
    platform_version: (r.platform_version as string) ?? null,
    release_version: (r.release_version as string) ?? null,
    prompt_version: (r.prompt_version as string) ?? null,
    language: (r.language as string) ?? null,
    disorder_slug: (r.disorder_slug as string) ?? null,
    difficulty: (r.difficulty as string) ?? null,
    context: {},
    evidence: {},
    analyst: {},
  };
}

/** GET — educational research export ?format=json|csv|package&redact=1 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.eoi.export",
    resourceType: "eoi_export",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-eoi-export:${auth.user.id}`,
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
    .from("eoi_opportunities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);

  let rows: EoiOpportunityRow[];
  if (error || !data) {
    if (!eoiMemoryEnabled()) {
      return NextResponse.json({ error: "EOI vault unavailable" }, { status: 503 });
    }
    rows = eoiMemoryList();
  } else {
    rows = data.map((r) => mapRow(r as Record<string, unknown>));
  }

  if (format === "csv") {
    const csv = opportunitiesToCsv(rows, redact);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="eoi-export.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  const clusters = clusterOpportunities(rows);
  const pkg = buildEoiResearchPackage(rows, clusters);
  return NextResponse.json(
    {
      ...pkg,
      opportunities: redact
        ? rows.map((r) => ({
            ...r,
            idea_text: `[redacted ${r.idea_text.length} chars]`,
            design_sketch: null,
            expected_learning_experience: null,
            annotations: [],
            transcript_window: [],
          }))
        : format === "package"
          ? undefined
          : rows,
      clusters: format === "package" ? clusters.slice(0, 100) : clusters,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

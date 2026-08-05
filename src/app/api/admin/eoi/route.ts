import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { decryptText } from "@/lib/cqi/crypto";
import type { EncBlob } from "@/lib/cqi/crypto";
import {
  buildEoiDashboard,
  clusterOpportunities,
  eoiMemoryEnabled,
  eoiMemoryList,
  eoiMemoryListClusters,
  type EoiOpportunityRow,
} from "@/lib/eoi";

export const dynamic = "force-dynamic";

function mapRow(r: Record<string, unknown>): EoiOpportunityRow {
  const enc = r.idea_text_enc as EncBlob | null | undefined;
  return {
    id: String(r.id),
    created_at: String(r.created_at),
    reviewer_id: (r.reviewer_id as string) ?? null,
    anonymous: Boolean(r.anonymous),
    session_id: (r.session_id as string) ?? null,
    opportunity_type: r.opportunity_type as EoiOpportunityRow["opportunity_type"],
    educational_impact: Number(r.educational_impact ?? 3),
    target_learners: (r.target_learners as string[]) ?? [],
    competencies: (r.competencies as string[]) ?? [],
    idea_text: decryptText(String(r.idea_text ?? ""), enc),
    design_sketch: (r.design_sketch as string) ?? null,
    expected_learning_experience:
      (r.expected_learning_experience as string) ?? null,
    annotations: (r.annotations as EoiOpportunityRow["annotations"]) ?? [],
    transcript_window: (r.transcript_window as unknown[]) ?? [],
    status: (r.status as EoiOpportunityRow["status"]) ?? "open",
    cluster_id: (r.cluster_id as string) ?? null,
    fingerprint: String(r.fingerprint ?? ""),
    platform_version: (r.platform_version as string) ?? null,
    release_version: (r.release_version as string) ?? null,
    prompt_version: (r.prompt_version as string) ?? null,
    language: (r.language as string) ?? null,
    disorder_slug: (r.disorder_slug as string) ?? null,
    difficulty: (r.difficulty as string) ?? null,
    context: (r.context as Record<string, unknown>) ?? {},
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    analyst: (r.analyst as Record<string, unknown>) ?? {},
  };
}

/** GET — EOI executive dashboard (separate from CQI defects) */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.eoi.dashboard",
    resourceType: "eoi",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-eoi:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("eoi_opportunities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  let rows: EoiOpportunityRow[];
  let source: "database" | "memory" = "database";
  if (error || !data) {
    if (!eoiMemoryEnabled()) {
      return NextResponse.json({ error: "EOI vault unavailable" }, { status: 503 });
    }
    rows = eoiMemoryList();
    source = "memory";
  } else {
    rows = data.map((r) => mapRow(r as Record<string, unknown>));
  }

  const clusters =
    source === "memory" ? eoiMemoryListClusters() : clusterOpportunities(rows);
  const dashboard = buildEoiDashboard(rows, clusters);

  return NextResponse.json({
    source,
    is_defect: false,
    kind: "educational_opportunity",
    dashboard,
    recent: rows.slice(0, 25).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      opportunity_type: r.opportunity_type,
      educational_impact: r.educational_impact,
      disorder_slug: r.disorder_slug,
      status: r.status,
      idea_preview: r.idea_text.slice(0, 180),
      competencies: r.competencies.slice(0, 5),
    })),
  });
}

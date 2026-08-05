import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  buildCqiDashboard,
  clusterFlags,
  decryptText,
  memoryListClusters,
  memoryListFlags,
  memoryVaultEnabled,
  type CqiFlagRow,
} from "@/lib/cqi";
import type { EncBlob } from "@/lib/cqi/crypto";

export const dynamic = "force-dynamic";

function mapRow(r: Record<string, unknown>): CqiFlagRow {
  const enc = r.free_text_enc as EncBlob | null | undefined;
  const free = decryptText(String(r.free_text ?? ""), enc);
  return {
    id: String(r.id),
    created_at: String(r.created_at),
    reviewer_id: (r.reviewer_id as string) ?? null,
    anonymous: Boolean(r.anonymous),
    session_id: (r.session_id as string) ?? null,
    category: r.category as CqiFlagRow["category"],
    severity: r.severity as CqiFlagRow["severity"],
    confidence: r.confidence as CqiFlagRow["confidence"],
    free_text: free,
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
    context: (r.context as CqiFlagRow["context"]) ?? {},
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    analyst_notes: (r.analyst_notes as Record<string, unknown>) ?? {},
  };
}

/** GET — CQI executive dashboard */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cqi.dashboard",
    resourceType: "cqi",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-cqi:${auth.user.id}`,
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
    .from("cqi_flags")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);

  let flags: CqiFlagRow[];
  let source: "database" | "memory" = "database";
  if (error || !data) {
    if (!memoryVaultEnabled()) {
      return NextResponse.json({ error: "CQI vault unavailable" }, { status: 503 });
    }
    flags = memoryListFlags();
    source = "memory";
  } else {
    flags = data.map((r) => mapRow(r as Record<string, unknown>));
  }

  const clusters =
    source === "memory"
      ? memoryListClusters()
      : clusterFlags(flags);

  const dashboard = buildCqiDashboard(flags, clusters);

  return NextResponse.json({
    source,
    dashboard,
    recent_flags: flags.slice(0, 30).map((f) => ({
      id: f.id,
      created_at: f.created_at,
      category: f.category,
      severity: f.severity,
      disorder_slug: f.disorder_slug,
      language: f.language,
      status: f.status,
      free_text_preview: f.free_text.slice(0, 160),
    })),
  });
}

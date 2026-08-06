import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  decryptText,
  memoryListFlags,
  memoryReplaceClusters,
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
    reviewer_id: (r.reviewer_id as string) ?? null,
    anonymous: Boolean(r.anonymous),
    session_id: (r.session_id as string) ?? null,
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
    context: (r.context as CqiFlagRow["context"]) ?? {},
    evidence: (r.evidence as Record<string, unknown>) ?? {},
    analyst_notes: (r.analyst_notes as Record<string, unknown>) ?? {},
  };
}

/**
 * POST — run AI Quality Analyst + persist clusters (admin).
 * Does NOT create GitHub issues or PRs.
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.cqi.analyze",
    resourceType: "cqi",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-cqi-analyze:${auth.user.id}`,
    20,
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

  const report = runQualityAnalyst(flags);

  if (source === "memory") {
    memoryReplaceClusters(report.clusters);
  } else {
    for (const c of report.clusters) {
      const { data: upserted, error: upErr } = await supabase
        .from("cqi_clusters")
        .upsert(
          {
            title: c.title,
            summary: c.summary,
            category: c.category,
            severity: c.severity,
            confidence_pct: c.confidence_pct,
            report_count: c.report_count,
            fingerprint: c.fingerprint,
            affected_languages: c.affected_languages,
            affected_disorders: c.affected_disorders,
            affected_voices: c.affected_voices,
            affected_prompt_versions: c.affected_prompt_versions,
            affected_releases: c.affected_releases,
            affected_models: c.affected_models,
            root_cause: c.root_cause,
            educational_impact: c.educational_impact,
            clinical_impact: c.clinical_impact,
            effort_estimate: c.effort_estimate,
            recommendation: c.recommendation,
            status: c.status,
            analyst: { notes: report.notes },
            engineering: c.engineering,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "fingerprint" },
        )
        .select("id, fingerprint")
        .maybeSingle();

      if (upErr || !upserted) continue;

      // Link members + store engineering rec (draft — human approval required)
      for (const flagId of c.member_flag_ids) {
        await supabase.rpc("cqi_update_flag_status", {
          p_flag_id: flagId,
          p_status: "clustered",
          p_cluster_id: upserted.id,
        });
      }

      await supabase.from("cqi_engineering_recs").insert({
        cluster_id: upserted.id,
        title: c.engineering.title,
        root_cause: c.engineering.root_cause,
        affected_files: c.engineering.affected_files,
        affected_subsystem: c.engineering.affected_subsystem,
        risk: c.engineering.risk,
        priority: c.engineering.priority,
        regression_requirements: c.engineering.regression_requirements,
        acceptance_criteria: c.engineering.acceptance_criteria,
        github_issue_md: c.engineering.github_issue_md,
        cursor_prompt: c.engineering.cursor_prompt,
        approval_status: "draft",
        payload: { requires_human_approval: true },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    source,
    analyst: {
      analyzed_at: report.analyzed_at,
      flag_count: report.flag_count,
      cluster_count: report.cluster_count,
      repeated_complaints: report.repeated_complaints,
      affected: report.affected,
      notes: report.notes,
    },
    clusters: report.clusters.map((c) => ({
      title: c.title,
      report_count: c.report_count,
      severity: c.severity,
      confidence_pct: c.confidence_pct,
      recommendation: c.recommendation,
      engineering_priority: c.engineering.priority,
      github_issue_preview: c.engineering.github_issue_md.slice(0, 400),
      cursor_prompt_preview: c.engineering.cursor_prompt.slice(0, 400),
      requires_human_approval: true,
    })),
  });
}

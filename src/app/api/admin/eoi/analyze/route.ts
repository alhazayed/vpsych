import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { decryptText, type EncBlob } from "@/lib/cqi/crypto";
import {
  eoiMemoryEnabled,
  eoiMemoryList,
  eoiMemoryReplaceClusters,
  runEducationalAnalyst,
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

/** POST — Educational Analyst + curriculum backlog (never defect triage) */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.eoi.analyze",
    resourceType: "eoi",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-eoi-analyze:${auth.user.id}`,
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

  const report = runEducationalAnalyst(rows);

  if (source === "memory") {
    eoiMemoryReplaceClusters(report.clusters);
  } else {
    for (const c of report.clusters) {
      const { data: upserted } = await supabase
        .from("eoi_clusters")
        .upsert(
          {
            title: c.title,
            summary: c.summary,
            opportunity_type: c.opportunity_type,
            report_count: c.report_count,
            confidence_pct: c.confidence_pct,
            fingerprint: c.fingerprint,
            educational_impact_avg: c.educational_impact_avg,
            expected_benefit: c.expected_benefit,
            target_learners: c.target_learners,
            competencies: c.competencies,
            affected_disorders: c.affected_disorders,
            affected_languages: c.affected_languages,
            affected_curriculum: c.affected_curriculum,
            difficulty_level: c.difficulty_level,
            educational_rationale: c.educational_rationale,
            learner_benefit: c.learner_benefit,
            research_value: c.research_value,
            effort_estimate: c.effort_estimate,
            educational_priority: c.educational_priority,
            strategic_value: c.strategic_value,
            backlog_score: c.backlog_score,
            status: c.status,
            analyst: { notes: report.notes, research_questions: report.research_questions },
            recommendation: c.recommendation,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "fingerprint" },
        )
        .select("id")
        .maybeSingle();

      if (!upserted) continue;
      for (const id of c.member_ids) {
        await supabase.rpc("eoi_update_status", {
          p_id: id,
          p_status: "under_review",
          p_cluster_id: upserted.id,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    source,
    is_defect: false,
    analyst: {
      analyzed_at: report.analyzed_at,
      opportunity_count: report.opportunity_count,
      cluster_count: report.cluster_count,
      notes: report.notes,
      research_questions: report.research_questions,
    },
    backlog: report.backlog.slice(0, 20).map((c) => ({
      title: c.title,
      backlog_score: c.backlog_score,
      educational_priority: c.educational_priority,
      expected_benefit: c.expected_benefit,
      report_count: c.report_count,
      competencies: c.competencies,
      target_learners: c.target_learners,
      cursor_prompt_preview: c.recommendation.cursor_prompt.slice(0, 400),
      requires_human_approval: true,
      is_defect: false,
    })),
  });
}

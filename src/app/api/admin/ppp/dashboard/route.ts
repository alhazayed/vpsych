import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { buildPppDashboard, type SessionAggRow } from "@/lib/ppp";
import type {
  PppBlindScore,
  PppCqiReport,
  PppEducationalOpportunity,
  PppFeatureRequest,
  PppReviewer,
  PppSessionRating,
} from "@/lib/ppp";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GET — Professional Preview Dashboard aggregates + Reviewer Analytics indices.
 * Admin only. Gracefully returns empty dashboard if PPP tables are missing.
 */
export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.ppp.dashboard",
    resourceType: "ppp_dashboard",
  });
  if (!auth.ok) return auth.response;

  const limited = await rateLimit(
    `admin-ppp:${auth.user.id}`,
    60,
    60 * 60 * 1000,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const supabase = auth.supabase;

  const [
    reviewersRes,
    sessionsRes,
    ratingsRes,
    cqiRes,
    eoiRes,
    frRes,
    blindRes,
  ] = await Promise.all([
    supabase.from("ppp_reviewers").select("is_active"),
    supabase
      .from("sessions")
      .select("id, status, started_at, ended_at, max_duration_sec"),
    supabase.from("ppp_session_ratings").select("*"),
    supabase.from("ppp_cqi_reports").select("severity, status"),
    supabase.from("ppp_educational_opportunities").select("opportunity_type"),
    supabase.from("ppp_feature_requests").select("theme, title"),
    supabase
      .from("ppp_blind_scores")
      .select("overall_realism, would_use_in_training"),
  ]);

  const tablesMissing =
    reviewersRes.error?.message?.includes("does not exist") ||
    ratingsRes.error?.message?.includes("does not exist");

  if (tablesMissing) {
    const empty = buildPppDashboard({
      reviewers: [],
      sessions: [],
      ratings: [],
      cqi: [],
      opportunities: [],
      featureRequests: [],
      blindScores: [],
    });
    return NextResponse.json({
      dashboard: empty,
      source: "unavailable",
      warning:
        "PPP tables not applied yet. Run migration 20260806083000_professional_preview_program.",
    });
  }

  const sessionRows = (sessionsRes.data ?? []) as Array<{
    id: string;
    status: string;
    started_at: string;
    ended_at: string | null;
    max_duration_sec: number | null;
  }>;

  // Message counts for conversation length (best-effort, capped)
  const messageCounts = new Map<string, number>();
  if (sessionRows.length > 0) {
    const ids = sessionRows.map((s) => s.id).slice(0, 500);
    const { data: msgs } = await supabase
      .from("session_messages")
      .select("session_id")
      .in("session_id", ids);
    for (const m of msgs ?? []) {
      const sid = (m as { session_id: string }).session_id;
      messageCounts.set(sid, (messageCounts.get(sid) ?? 0) + 1);
    }
  }

  const sessions: SessionAggRow[] = sessionRows.map((s) => ({
    ...s,
    message_count: messageCounts.get(s.id) ?? 0,
  }));

  const dashboard = buildPppDashboard({
    reviewers: (reviewersRes.data ?? []) as Pick<PppReviewer, "is_active">[],
    sessions,
    ratings: (ratingsRes.data ?? []) as PppSessionRating[],
    cqi: (cqiRes.data ?? []) as Pick<PppCqiReport, "severity" | "status">[],
    opportunities: (eoiRes.data ?? []) as Pick<
      PppEducationalOpportunity,
      "opportunity_type"
    >[],
    featureRequests: (frRes.data ?? []) as Pick<
      PppFeatureRequest,
      "theme" | "title"
    >[],
    blindScores: (blindRes.data ?? []) as Pick<
      PppBlindScore,
      "overall_realism" | "would_use_in_training"
    >[],
  });

  return NextResponse.json({
    dashboard,
    source: "database",
    warnings: [
      reviewersRes.error?.message,
      sessionsRes.error?.message,
      ratingsRes.error?.message,
      cqiRes.error?.message,
      eoiRes.error?.message,
      frRes.error?.message,
      blindRes.error?.message,
    ].filter(Boolean),
  });
}

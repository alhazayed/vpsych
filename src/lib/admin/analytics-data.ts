/**
 * Data loading for the admin analytics page.
 *
 * PostgREST caps a single select at 1000 rows and a long `.in()` list can
 * exceed URL limits, so both reads are paged/batched here. Query errors are
 * surfaced to the caller instead of rendering as zeros.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isHeuristicReportScores } from "@/lib/admin/report-regenerate";

export type AnalyticsSessionRow = {
  id: string;
  status: string;
  language: string | null;
  institution_id: string | null;
  institutions: { name: string } | null;
};

export type ReportScoreRow = { scores: unknown };

export type ReportSummary = {
  /** All reports linked to the period's sessions, fallback included. */
  reportsCount: number;
  /** Reports produced by the heuristic fallback (excluded from the mean). */
  fallbackCount: number;
  /** Mean overall score across examiner-scored reports, or null if none. */
  avgOverall: number | null;
};

const PAGE_SIZE = 1000;
/** Hard stop so a runaway range cannot loop forever (100k sessions). */
const MAX_PAGES = 100;
const ID_BATCH = 200;

export function summarizeReportScores(rows: ReportScoreRow[]): ReportSummary {
  let fallbackCount = 0;
  const overalls: number[] = [];
  for (const row of rows) {
    if (isHeuristicReportScores(row.scores)) {
      fallbackCount += 1;
      continue;
    }
    const overall =
      row.scores && typeof row.scores === "object"
        ? (row.scores as { overall?: unknown }).overall
        : null;
    if (typeof overall === "number" && Number.isFinite(overall)) {
      overalls.push(overall);
    }
  }
  return {
    reportsCount: rows.length,
    fallbackCount,
    avgOverall:
      overalls.length > 0
        ? Math.round(overalls.reduce((a, b) => a + b, 0) / overalls.length)
        : null,
  };
}

export type PeriodAnalyticsResult =
  | { ok: true; sessions: AnalyticsSessionRow[]; reports: ReportSummary }
  | { ok: false; stage: "sessions" | "reports"; message: string };

export async function loadPeriodAnalytics(
  supabase: SupabaseClient,
  sinceIso: string,
): Promise<PeriodAnalyticsResult> {
  const sessions: AnalyticsSessionRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabase
      .from("sessions")
      .select(
        "id, status, language, institution_id, institutions:institution_id ( name )",
      )
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      return { ok: false, stage: "sessions", message: error.message };
    }
    const rows = (data ?? []) as unknown as AnalyticsSessionRow[];
    sessions.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  const reportRows: ReportScoreRow[] = [];
  const ids = sessions.map((s) => s.id);
  for (let i = 0; i < ids.length; i += ID_BATCH) {
    const { data, error } = await supabase
      .from("session_reports")
      .select("scores")
      .in("session_id", ids.slice(i, i + ID_BATCH));
    if (error) {
      return { ok: false, stage: "reports", message: error.message };
    }
    reportRows.push(...((data ?? []) as ReportScoreRow[]));
  }

  return { ok: true, sessions, reports: summarizeReportScores(reportRows) };
}

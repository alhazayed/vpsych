/**
 * CSV export of session reports for instructors (admin-only route).
 *
 * Cells are quoted per RFC 4180, and any cell that a spreadsheet would read
 * as a formula (leading = + - @, tab or CR) is prefixed with an apostrophe,
 * because learner display names are user-controlled (CSV/formula injection).
 */

import { isHeuristicReportScores } from "@/lib/admin/report-regenerate";

export type ReportExportRow = {
  session_id: string;
  created_at: string;
  language: string | null;
  scores: unknown;
  sessions: {
    started_at: string | null;
    ended_at: string | null;
    status: string | null;
    profiles: { display_name: string | null } | null;
    avatars: { name: string | null; disorder: string | null } | null;
  } | null;
};

export const REPORT_CSV_HEADER = [
  "session_id",
  "report_created_at",
  "session_started_at",
  "session_ended_at",
  "session_status",
  "learner",
  "patient",
  "disorder",
  "language",
  "overall_score",
  "assessment_mode",
  "rubric_items",
] as const;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value) : String(value);
  if (typeof value !== "number" && FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

type ScoreItemLike = { label?: unknown; id?: unknown; score?: unknown; max?: unknown };

function rubricSummary(scores: unknown): string {
  const items = (scores as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return "";
  return items
    .map((raw) => {
      const item = (raw ?? {}) as ScoreItemLike;
      const label = String(item.label ?? item.id ?? "").trim();
      if (!label || typeof item.score !== "number") return null;
      const max = typeof item.max === "number" ? `/${item.max}` : "";
      return `${label}: ${item.score}${max}`;
    })
    .filter((s): s is string => s !== null)
    .join("; ");
}

function overallScore(scores: unknown): number | null {
  const overall = (scores as { overall?: unknown } | null)?.overall;
  return typeof overall === "number" && Number.isFinite(overall) ? overall : null;
}

export function reportToCsvRecord(row: ReportExportRow): string[] {
  const s = row.sessions;
  return [
    row.session_id,
    row.created_at,
    s?.started_at ?? "",
    s?.ended_at ?? "",
    s?.status ?? "",
    s?.profiles?.display_name ?? "",
    s?.avatars?.name ?? "",
    s?.avatars?.disorder ?? "",
    row.language ?? "",
    overallScore(row.scores) === null ? "" : String(overallScore(row.scores)),
    isHeuristicReportScores(row.scores) ? "heuristic_fallback" : "ai_examiner",
    rubricSummary(row.scores),
  ];
}

/** Full CSV document with a UTF-8 BOM so Excel reads Arabic names correctly. */
export function buildReportsCsv(rows: ReportExportRow[]): string {
  const lines = [REPORT_CSV_HEADER.join(",")];
  for (const row of rows) {
    lines.push(reportToCsvRecord(row).map(csvCell).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

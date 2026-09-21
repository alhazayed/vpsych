/**
 * Session operations helpers — presentation only; no fabricated statuses.
 */

import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import { isSessionTimedOut } from "@/lib/session-expiry";
import { MAX_SESSION_SECONDS, type SessionStatus } from "@/lib/types";

export type SessionReportStatus = "available" | "none";

export function sessionStatusTone(
  status: SessionStatus,
): "active" | "warning" | "info" | "neutral" {
  if (status === "completed") return "active";
  if (status === "expired") return "warning";
  if (status === "active") return "info";
  return "neutral";
}

export type DurationDisplay = {
  /** Short label for tables, e.g. "12m", "Past limit" */
  label: string;
  /** True when status is active but wall-clock exceeds max duration */
  stale: boolean;
};

/**
 * Format session duration for admin display.
 *
 * - Terminal sessions (completed/expired): use ended_at − started_at.
 * - Active within limit: show elapsed as "in progress" (e.g. "12m elapsed").
 * - Active past max duration: never show multi-day wall-clock; mark as stale.
 * - Missing ended_at on terminal rows: "—".
 */
export function formatSessionDurationDisplay(
  status: SessionStatus,
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
  maxDurationSec: number = MAX_SESSION_SECONDS,
  nowMs: number = Date.now(),
): DurationDisplay | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return null;

  if (status === "active") {
    if (isSessionTimedOut(startedAt, maxDurationSec, nowMs)) {
      return { label: "past_limit", stale: true };
    }
    const mins = Math.max(0, Math.round((nowMs - start) / 60000));
    return { label: formatMinutes(mins), stale: false };
  }

  if (!endedAt) return null;
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(end) || end < start) return null;
  return {
    label: formatMinutes(Math.round((end - start) / 60000)),
    stale: false,
  };
}

/** @deprecated Prefer formatSessionDurationDisplay for status-aware labels. */
export function formatSessionDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string | null {
  const d = formatSessionDurationDisplay(
    endedAt ? "completed" : "active",
    startedAt,
    endedAt,
  );
  return d?.label ?? null;
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function shortSessionId(id: string): string {
  return id.slice(0, 8);
}

export function isAdminTestClinicalSnapshot(snapshot: unknown): boolean {
  return isAdminTestSnapshot(snapshot);
}

export type AdminSessionListRow = {
  id: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  language: string;
  learner: string;
  patient: string;
  disorder: string;
  organization: string | null;
  institutionId: string | null;
  durationLabel: string | null;
  durationStale: boolean;
  score: number | null;
  reportStatus: SessionReportStatus;
  isAdminTest: boolean;
  difficulty: string | null;
  modality: string | null;
};

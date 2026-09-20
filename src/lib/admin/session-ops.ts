/**
 * Session operations helpers — presentation only; no fabricated statuses.
 */

import { isAdminTestSnapshot } from "@/lib/admin/admin-test-session";
import type { SessionStatus } from "@/lib/types";

export type SessionReportStatus = "available" | "none";

export function sessionStatusTone(
  status: SessionStatus,
): "active" | "warning" | "info" | "neutral" {
  if (status === "completed") return "active";
  if (status === "expired") return "warning";
  if (status === "active") return "info";
  return "neutral";
}

export function formatSessionDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  const mins = Math.round((end - start) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function shortSessionId(id: string): string {
  return id.slice(0, 8);
}

export function isAdminTestClinicalSnapshot(
  snapshot: unknown,
): boolean {
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
  score: number | null;
  reportStatus: SessionReportStatus;
  isAdminTest: boolean;
  difficulty: string | null;
  modality: string | null;
};

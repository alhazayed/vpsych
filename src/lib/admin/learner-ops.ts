/**
 * Admin learner directory helpers — presentation + query shaping only.
 * Canonical learner id = profiles.id (sessions.therapist_id).
 * No schema inventiveness; ACE learner_profiles is optional enrichment.
 */

export const LEARNER_PAGE_SIZE = 25;
export const SESSION_PAGE_SIZE = 50;

export type LearnerListRow = {
  id: string;
  displayName: string;
  role: string;
  organization: string | null;
  preferredLanguage: string | null;
  sessionCount: number;
  completedCount: number;
  lastActiveAt: string | null;
};

export type LearnerSessionStats = {
  total: number;
  completed: number;
  expired: number;
  active: number;
  withReport: number;
  avgOverall: number | null;
  lastActiveAt: string | null;
};

export function aggregateSessionStats(
  sessions: Array<{
    status: string;
    started_at: string;
    ended_at: string | null;
    reportOverall: number | null;
    hasReport: boolean;
  }>,
): LearnerSessionStats {
  let completed = 0;
  let expired = 0;
  let active = 0;
  let withReport = 0;
  const scores: number[] = [];
  let lastActiveAt: string | null = null;

  for (const s of sessions) {
    if (s.status === "completed") completed += 1;
    else if (s.status === "expired") expired += 1;
    else if (s.status === "active") active += 1;
    if (s.hasReport) withReport += 1;
    if (typeof s.reportOverall === "number") scores.push(s.reportOverall);
    const stamp = s.ended_at ?? s.started_at;
    if (!lastActiveAt || stamp > lastActiveAt) lastActiveAt = stamp;
  }

  return {
    total: sessions.length,
    completed,
    expired,
    active,
    withReport,
    avgOverall:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null,
    lastActiveAt,
  };
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  if (totalPages < 1) return 1;
  return Math.min(page, totalPages);
}

export function totalPages(total: number, pageSize: number): number {
  if (total <= 0) return 0;
  return Math.ceil(total / pageSize);
}

export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

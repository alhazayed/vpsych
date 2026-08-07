import type { InstitutionalFeedback } from "./types";

const rows: InstitutionalFeedback[] = [];

/** Process-memory store (multi-instance → Postgres via API best-effort). */
export function storeFeedback(row: InstitutionalFeedback): void {
  rows.unshift(row);
  if (rows.length > 5000) rows.length = 5000;
}

export function listFeedback(limit = 200): InstitutionalFeedback[] {
  return rows.slice(0, Math.max(1, Math.min(limit, 2000)));
}

export function clearFeedbackStoreForTests(): void {
  rows.length = 0;
}

export function feedbackSummary() {
  const byRole: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    byRole[r.role_persona] = (byRole[r.role_persona] ?? 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  }
  const ratings = rows
    .map((r) => r.rating)
    .filter((n): n is number => typeof n === "number");
  const avgRating =
    ratings.length === 0
      ? null
      : Math.round(
          (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100,
        ) / 100;
  return {
    total: rows.length,
    critical: bySeverity.critical ?? 0,
    high: bySeverity.high ?? 0,
    avgRating,
    byRole,
    bySeverity,
    byCategory,
  };
}

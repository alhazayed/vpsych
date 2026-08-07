/**
 * In-memory store for validation runs + expert ratings (research session).
 * Optional DB persistence via migration tables when service role available.
 */

import type { ExpertRating, ValidationRunResult } from "@/lib/validation/types";

const runs = new Map<string, ValidationRunResult>();
const ratings = new Map<string, ExpertRating>();
const auditLog: Array<{
  id: string;
  at: string;
  action: string;
  detail: Record<string, unknown>;
}> = [];

export function storeValidationRun(run: ValidationRunResult): void {
  runs.set(run.id, run);
  auditLog.push({
    id: `log_${auditLog.length + 1}`,
    at: new Date().toISOString(),
    action: "validation_run_stored",
    detail: { run_id: run.id, session_id: run.session_id },
  });
}

export function listValidationRuns(limit = 500): ValidationRunResult[] {
  return [...runs.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export function getValidationRun(id: string): ValidationRunResult | null {
  return runs.get(id) ?? null;
}

export function storeExpertRating(rating: ExpertRating): void {
  ratings.set(rating.id, rating);
  auditLog.push({
    id: `log_${auditLog.length + 1}`,
    at: new Date().toISOString(),
    action: "expert_rating_stored",
    detail: {
      rating_id: rating.id,
      domain: rating.domain,
      case_key: rating.case_key,
    },
  });
}

export function listExpertRatings(limit = 5000): ExpertRating[] {
  return [...ratings.values()]
    .sort((a, b) => b.rated_at.localeCompare(a.rated_at))
    .slice(0, limit);
}

export function listValidationAuditLog(limit = 500) {
  return auditLog.slice(-limit);
}

export function clearValidationStoreForTests(): void {
  runs.clear();
  ratings.clear();
  auditLog.length = 0;
}

/**
 * Assessment reliability harness — extraction (CI-S05 / Phase 4 C-5).
 *
 * Converts a persisted `session_reports.scores` blob into a `ReliabilitySubject`.
 *
 * This module deliberately reads ONLY numeric score structure and configuration
 * provenance. It never reads `narrative`, `excerpts`, or any free text, so a
 * reliability run cannot carry transcript content out of the admin boundary
 * (readiness assessment risk R-5).
 */

import type {
  ReliabilityItem,
  ReliabilitySubject,
} from "@/lib/assessment-reliability/types";

/** Loose shape of a persisted report row, as read from the database. */
export type StoredReportLike = {
  session_id?: string | null;
  language?: string | null;
  scores?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseItems(raw: unknown): ReliabilityItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ReliabilityItem[] = [];
  for (const entry of raw) {
    const rec = asRecord(entry);
    if (!rec) continue;
    const id = asNonEmptyString(rec.id);
    const score = asFiniteNumber(rec.score);
    if (!id || score == null) continue;
    items.push({
      id,
      score,
      max: asFiniteNumber(rec.max) ?? 5,
      weight: asFiniteNumber(rec.weight) ?? 0,
    });
  }
  return items;
}

/**
 * Extract one subject from a stored report.
 *
 * Returns null when the row carries no usable item structure — a report that
 * cannot contribute is dropped rather than zero-filled.
 */
export function subjectFromStoredReport(
  row: StoredReportLike,
): ReliabilitySubject | null {
  const scores = asRecord(row.scores);
  if (!scores) return null;

  const items = parseItems(scores.items);
  if (items.length === 0) return null;

  const overall = asFiniteNumber(scores.overall);
  if (overall == null) return null;

  const provenance = asRecord(scores.scientific_provenance);

  return {
    session_id: row.session_id ?? null,
    overall,
    items,
    language: row.language ?? null,
    ai_model: provenance ? asNonEmptyString(provenance.ai_model) : null,
    ai_source: provenance ? asNonEmptyString(provenance.ai_source) : null,
    prompt_engine_version: provenance
      ? asNonEmptyString(provenance.prompt_engine_version)
      : null,
    assessment_mode: provenance ? asNonEmptyString(provenance.assessment_mode) : null,
  };
}

export function subjectsFromStoredReports(
  rows: StoredReportLike[],
): ReliabilitySubject[] {
  return rows
    .map(subjectFromStoredReport)
    .filter((s): s is ReliabilitySubject => s !== null);
}

/**
 * Restrict a sample to one configuration.
 *
 * Mixing configurations confounds the instrument with the model and prompt that
 * produced the scores, so a configuration-controlled sub-sample is the only
 * defensible basis for an internal-consistency claim.
 */
export function filterToConfiguration(
  subjects: ReliabilitySubject[],
  opts: { model?: string | null; promptVersion?: string | null },
): ReliabilitySubject[] {
  return subjects.filter((s) => {
    if (opts.model != null && s.ai_model !== opts.model) return false;
    if (opts.promptVersion != null && s.prompt_engine_version !== opts.promptVersion) {
      return false;
    }
    return true;
  });
}

/**
 * Drop subjects scored by the heuristic keyword fallback.
 *
 * That path is a degradation route, not the examiner. `buildAssessmentProvenance`
 * attaches the limitation "Heuristic keyword scoring is a degradation path, not a
 * validated OSCE instrument" to exactly these rows, so pooling them with examiner
 * scores measures the mixture rather than either instrument (F-FIND-3).
 */
export function excludeHeuristicFallback(
  subjects: ReliabilitySubject[],
): ReliabilitySubject[] {
  return subjects.filter((s) => s.assessment_mode !== "heuristic_fallback");
}

/** Subjects that carry a complete model + prompt-version provenance record. */
export function withCompleteProvenance(
  subjects: ReliabilitySubject[],
): ReliabilitySubject[] {
  return subjects.filter((s) => Boolean(s.ai_model) && Boolean(s.prompt_engine_version));
}

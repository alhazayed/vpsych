/**
 * Assessment reliability harness — computation (CI-S05 / Phase 4 C-5).
 *
 * Reuses the shared primitives in `lib/scientific/psychometrics.ts` rather than
 * reimplementing them. Two deliberate departures from that module:
 *
 *  1. Discrimination is reported PER ITEM here, as a corrected item–total
 *     correlation. The shared `itemTotalDiscrimination()` returns a single
 *     mean across items — useful as a summary, but a reliability report needs
 *     the per-item breakdown to identify which item is weak. (Both now use the
 *     corrected rest-score form; the degenerate version was fixed under
 *     F-FIND-2.)
 *
 *  2. `inter_rater_r` is never read from stored reports. Reports written before
 *     the F-FIND-1 fix carry a SIMULATED value produced from a single rater, and
 *     that historical data is still in the corpus. Excluding the field is
 *     therefore permanent, not transitional.
 *
 * This module is read-only: no model calls, no database access, no writes.
 */

import { cronbachAlpha, mean, pearson, stddev } from "@/lib/scientific/psychometrics";
import type {
  ItemStatistics,
  ReliabilityReport,
  ReliabilitySubject,
  SampleProvenance,
} from "@/lib/assessment-reliability/types";

export const RELIABILITY_HARNESS_VERSION = "1.0.0";

/** Minimum subjects below which alpha is not reported at all. */
export const MIN_SUBJECTS_FOR_ALPHA = 2;

/**
 * Sample size below which alpha is reported but flagged as unstable.
 * Not an authored psychometric standard — a conservative engineering guard so a
 * tiny sample cannot be quoted without a caveat attached. The defensible
 * threshold is a decision for the psychometric authority (OD-21).
 */
export const SMALL_SAMPLE_THRESHOLD = 100;

function uniqueDefined(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === "string" && v.length > 0))].sort();
}

/** Assessment mode label used for heuristic keyword scoring, not the examiner. */
export const HEURISTIC_FALLBACK_MODE = "heuristic_fallback";

function summarizeProvenance(subjects: ReliabilitySubject[]): SampleProvenance {
  const models = uniqueDefined(subjects.map((s) => s.ai_model));
  const prompts = uniqueDefined(subjects.map((s) => s.prompt_engine_version));
  const sources = uniqueDefined(subjects.map((s) => s.ai_source));
  const modes = uniqueDefined(subjects.map((s) => s.assessment_mode));
  const fallback = subjects.filter(
    (s) => s.assessment_mode === HEURISTIC_FALLBACK_MODE,
  ).length;

  // Incomplete means missing EITHER field. Counting only the both-missing case
  // silently passed heuristic-fallback rows, which carry a prompt version but a
  // null model (F-FIND-3).
  const missing = subjects.filter(
    (s) => !s.ai_model || !s.prompt_engine_version,
  ).length;

  // `uniqueDefined` drops nulls, so a null model cannot be relied on to widen
  // `distinct_models`. Homogeneity therefore also requires that no subject is
  // missing provenance and that only one assessment mode is present.
  const homogeneous =
    subjects.length > 0 &&
    models.length === 1 &&
    prompts.length === 1 &&
    modes.length <= 1 &&
    missing === 0;

  return {
    n_subjects: subjects.length,
    distinct_models: models,
    distinct_prompt_versions: prompts,
    distinct_ai_sources: sources,
    distinct_assessment_modes: modes,
    subjects_heuristic_fallback: fallback,
    configuration_homogeneous: homogeneous,
    subjects_missing_provenance: missing,
  };
}

/**
 * Dimensions present in EVERY subject, in the order of the first subject.
 * A dimension missing from any subject is excluded rather than zero-filled —
 * zero-filling a missing item silently deflates both the item and alpha.
 */
function commonDimensions(subjects: ReliabilitySubject[]): string[] {
  if (!subjects.length) return [];
  const first = subjects[0]!.items.map((i) => i.id);
  return first.filter((id) => subjects.every((s) => s.items.some((i) => i.id === id)));
}

function normalizedScore(subject: ReliabilitySubject, id: string): number | null {
  const item = subject.items.find((i) => i.id === id);
  if (!item) return null;
  const max = item.max || 5;
  if (max <= 0) return null;
  return (item.score / max) * 5;
}

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

/**
 * Build a reliability report from already-scored subjects.
 *
 * Produces `blocking` reasons rather than throwing, so a caller can surface an
 * uninterpretable sample honestly instead of reporting a number anyway.
 */
export function computeReliabilityReport(
  subjects: ReliabilitySubject[],
  now: () => Date = () => new Date(),
): ReliabilityReport {
  const provenance = summarizeProvenance(subjects);
  const dimensions = commonDimensions(subjects);
  const blocking: string[] = [];
  const limitations: string[] = [];

  if (subjects.length < MIN_SUBJECTS_FOR_ALPHA) {
    blocking.push(`Fewer than ${MIN_SUBJECTS_FOR_ALPHA} subjects — no statistic is computable.`);
  }
  if (dimensions.length < 2) {
    blocking.push("Fewer than 2 dimensions common to every subject — alpha is undefined.");
  }

  const matrix = subjects.map((s) =>
    dimensions.map((id) => normalizedScore(s, id) ?? 0),
  );
  const overalls = subjects.map((s) => s.overall);

  const alpha = blocking.length ? null : cronbachAlpha(matrix);

  const items: ItemStatistics[] = dimensions.map((id, index) => {
    const column = matrix.map((row) => row[index]!);
    const restSums = matrix.map((row) =>
      row.reduce((acc, value, j) => (j === index ? acc : acc + value), 0),
    );
    const reduced = matrix.map((row) => row.filter((_, j) => j !== index));
    const srcItems = subjects
      .map((s) => s.items.find((i) => i.id === id))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));
    const ceiling = srcItems.filter((i) => i.score >= (i.max || 5)).length;
    const floor = srcItems.filter((i) => i.score <= 0).length;
    return {
      id,
      n: column.length,
      mean: round(mean(column), 3),
      sd: round(stddev(column), 3),
      corrected_item_total_r:
        blocking.length ? null : roundOrNull(pearson(column, restSums), 3),
      alpha_if_dropped:
        blocking.length || dimensions.length < 3 ? null : roundOrNull(cronbachAlpha(reduced), 3),
      ceiling_rate: srcItems.length ? round(ceiling / srcItems.length, 3) : 0,
      floor_rate: srcItems.length ? round(floor / srcItems.length, 3) : 0,
    };
  });

  // Non-fatal interpretation limits.
  if (!provenance.configuration_homogeneous && subjects.length > 0) {
    limitations.push(
      "Sample is not configuration-homogeneous: model and/or prompt version vary, or are unrecorded. " +
        "Reliability estimated across mixed configurations confounds instrument with configuration.",
    );
  }
  if (provenance.subjects_missing_provenance > 0) {
    limitations.push(
      `${provenance.subjects_missing_provenance} of ${subjects.length} subjects carry incomplete model/prompt provenance.`,
    );
  }
  if (provenance.subjects_heuristic_fallback > 0) {
    limitations.push(
      `${provenance.subjects_heuristic_fallback} of ${subjects.length} subjects were scored by the HEURISTIC KEYWORD FALLBACK, not the LLM examiner. ` +
        "The source module labels that path \"not a validated OSCE instrument\". Pooling it with examiner scores " +
        "measures the mixture rather than either instrument — exclude it with excludeHeuristicFallback() before " +
        "quoting any statistic here.",
    );
  }
  if (subjects.length > 0 && subjects.length < SMALL_SAMPLE_THRESHOLD) {
    limitations.push(
      `Small sample (n=${subjects.length}). Alpha is unstable at this size; the defensible minimum is a decision for the psychometric authority.`,
    );
  }
  limitations.push(
    "Scoring is non-deterministic (examiner temperature 0.3). Internal consistency does not establish test–retest reliability.",
  );
  limitations.push(
    "Rating dimensions carry no behavioural anchors, so agreement statistics conflate instrument ambiguity with rater behaviour.",
  );
  limitations.push(
    "inter_rater_r in stored reports is SIMULATED from a single rater and is excluded here by construction.",
  );

  return {
    harness_version: RELIABILITY_HARNESS_VERSION,
    generated_at: now().toISOString(),
    provenance,
    dimensions,
    n_subjects: subjects.length,
    cronbach_alpha: roundOrNull(alpha, 3),
    overall_mean: overalls.length ? round(mean(overalls), 2) : 0,
    overall_sd: overalls.length ? round(stddev(overalls), 2) : 0,
    overall_min: overalls.length ? Math.min(...overalls) : 0,
    overall_max: overalls.length ? Math.max(...overalls) : 0,
    items,
    limitations,
    blocking,
  };
}

function roundOrNull(value: number | null, dp: number): number | null {
  return value == null || Number.isNaN(value) ? null : round(value, dp);
}

/**
 * Assessment reliability harness (CI-S05 / Phase 4 C-5).
 *
 * Import from this barrel, not from internal modules.
 *
 * What this harness DOES: compute internal-consistency and item statistics over
 * assessment scores that already exist.
 *
 * What it DOES NOT do, by construction: score a session, call a model, read any
 * narrative or transcript text, write to the database, or establish validity.
 * Internal consistency is not validity, and none of its output may be described
 * as validating the instrument.
 */

export type {
  ItemStatistics,
  ReliabilityItem,
  ReliabilityReport,
  ReliabilitySubject,
  SampleProvenance,
} from "@/lib/assessment-reliability/types";

export {
  HEURISTIC_FALLBACK_MODE,
  MIN_SUBJECTS_FOR_ALPHA,
  RELIABILITY_HARNESS_VERSION,
  SMALL_SAMPLE_THRESHOLD,
  computeReliabilityReport,
} from "@/lib/assessment-reliability/reliability";

export type { StoredReportLike } from "@/lib/assessment-reliability/extract";
export {
  excludeHeuristicFallback,
  filterToConfiguration,
  subjectFromStoredReport,
  subjectsFromStoredReports,
  withCompleteProvenance,
} from "@/lib/assessment-reliability/extract";

export type {
  ItemStability,
  ScoringOccasion,
  TestRetestReport,
} from "@/lib/assessment-reliability/test-retest";
export {
  MIN_OCCASIONS,
  TEST_RETEST_HARNESS_VERSION,
  computeTestRetestReport,
} from "@/lib/assessment-reliability/test-retest";

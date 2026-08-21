/**
 * Assessment reliability harness — types (CI-S05 / Phase 4 C-5).
 *
 * Scope: computes reliability statistics over already-produced assessment scores.
 * It never scores a session, never calls a model, and never writes anything.
 *
 * Standing constraint: nothing this module produces validates the instrument.
 * It measures reproducibility and internal structure only.
 */

/** One assessment item as persisted in `session_reports.scores.items`. */
export type ReliabilityItem = {
  id: string;
  score: number;
  max: number;
  weight: number;
};

/**
 * One subject (session) contributing to a reliability sample.
 *
 * `overall` is read from the stored report — it is never recomputed here.
 * `weightedOverall()` in `lib/ai/assessment.ts` remains the single owner of that
 * formula and must not be forked (see `src/lib/architecture.test.ts`).
 */
export type ReliabilitySubject = {
  session_id?: string | null;
  overall: number;
  items: ReliabilityItem[];
  language?: string | null;
  ai_model?: string | null;
  ai_source?: string | null;
  prompt_engine_version?: string | null;
  assessment_mode?: string | null;
};

/** Per-item statistics across the sample. */
export type ItemStatistics = {
  id: string;
  n: number;
  mean: number;
  sd: number;
  /**
   * Corrected item–total correlation: this item against the sum of the OTHER
   * items. Corrected (rest-score) form is used deliberately — correlating an
   * item with a total that contains it is inflated by construction.
   */
  corrected_item_total_r: number | null;
  /** Cronbach's alpha for the scale with this item removed. */
  alpha_if_dropped: number | null;
  /** Share of subjects at the item's maximum / minimum. */
  ceiling_rate: number;
  floor_rate: number;
};

/** Configuration homogeneity of the sample. */
export type SampleProvenance = {
  n_subjects: number;
  distinct_models: string[];
  distinct_prompt_versions: string[];
  distinct_ai_sources: string[];
  /**
   * Assessment modes present — `llm_examiner` and/or `heuristic_fallback`.
   *
   * These are NOT the same instrument. `buildAssessmentProvenance` labels
   * heuristic scoring "not a validated OSCE instrument"; pooling it with
   * examiner scores measures the mixture, not either one (F-FIND-3).
   */
  distinct_assessment_modes: string[];
  /** Subjects scored by the heuristic keyword fallback rather than the examiner. */
  subjects_heuristic_fallback: number;
  /**
   * True only when the sample is homogeneous on model AND prompt version AND
   * assessment mode, and every subject carries a model. A heuristic-fallback
   * subject has a null model, which used to leave this `true` because null was
   * dropped before the distinctness check — fixed under F-FIND-3.
   */
  configuration_homogeneous: boolean;
  /**
   * Subjects whose provenance is incomplete — missing a model OR a prompt
   * version. Counts partial records, not only wholly absent ones: a
   * heuristic-fallback report carries a prompt version but no model, and
   * counting only the both-missing case hid it entirely (F-FIND-3).
   */
  subjects_missing_provenance: number;
};

export type ReliabilityReport = {
  harness_version: string;
  generated_at: string;
  provenance: SampleProvenance;
  /** Dimension ids present in every subject, in stable order. */
  dimensions: string[];
  n_subjects: number;
  /** Internal consistency over the item matrix. Null when n < 2 or k < 2. */
  cronbach_alpha: number | null;
  overall_mean: number;
  overall_sd: number;
  overall_min: number;
  overall_max: number;
  items: ItemStatistics[];
  /** Non-fatal conditions that limit interpretation. */
  limitations: string[];
  /** Fatal conditions — the report is not interpretable at all. */
  blocking: string[];
};

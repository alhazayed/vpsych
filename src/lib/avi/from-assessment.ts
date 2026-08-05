/**
 * Build AVI input from assessment scores + psychometric / fairness context.
 */

import type { ScoreEntry } from "@/lib/types";
import type { AviComputeInput } from "@/lib/avi/types";
import { RUBRIC_TO_COMPETENCIES } from "@/lib/ace/catalog";
import {
  ASSESSMENT_SCHEMA_VERSION,
  PROMPT_ENGINE_VERSION,
  RUBRIC_SCHEMA_VERSION,
} from "@/lib/scientific/versions";

export function aviInputFromAssessment(opts: {
  items: ScoreEntry[];
  narrative?: string | null;
  excerpts?: string[] | null;
  locale: string;
  assessment_mode?: AviComputeInput["assessment_mode"];
  learning_objectives_count?: number;
  has_scientific_provenance?: boolean;
  has_external_criterion?: boolean | null;
  criterion_correlation?: number | null;
  cronbach_alpha?: number | null;
  test_retest_r?: number | null;
  discrimination_index?: number | null;
  difficulty_separation?: number | null;
  fairness_pass?: boolean | null;
  language_parity_within_tolerance?: boolean | null;
  language_parity_abs_diff?: number | null;
  repeated_overalls?: number[] | null;
  model_version?: string | null;
}): AviComputeInput {
  const items = opts.items ?? [];
  const feedbacks = items
    .map((i) => (i.feedback ?? "").trim())
    .filter((f) => f.length > 0 && !/^no feedback/i.test(f));
  const meanChars = feedbacks.length
    ? feedbacks.reduce((a, f) => a + f.length, 0) / feedbacks.length
    : 0;

  const mapped = new Set<string>();
  for (const item of items) {
    const comps = RUBRIC_TO_COMPETENCIES[item.id];
    if (comps) for (const c of comps) mapped.add(c);
  }

  return {
    locale: opts.locale,
    assessment_mode: opts.assessment_mode ?? null,
    rubric_item_count: items.length,
    clinical_core_item_ids: items.map((i) => i.id),
    competencies_mapped: mapped.size,
    learning_objectives_count: opts.learning_objectives_count ?? 0,
    mean_feedback_chars: meanChars,
    narrative_chars: (opts.narrative ?? "").length,
    excerpt_count: opts.excerpts?.length ?? 0,
    has_scientific_provenance: Boolean(opts.has_scientific_provenance),
    has_external_criterion: opts.has_external_criterion ?? false,
    criterion_correlation: opts.criterion_correlation ?? null,
    cronbach_alpha: opts.cronbach_alpha ?? null,
    test_retest_r: opts.test_retest_r ?? null,
    discrimination_index: opts.discrimination_index ?? null,
    difficulty_separation: opts.difficulty_separation ?? null,
    fairness_pass: opts.fairness_pass ?? null,
    language_parity_within_tolerance:
      opts.language_parity_within_tolerance ?? null,
    language_parity_abs_diff: opts.language_parity_abs_diff ?? null,
    repeated_overalls: opts.repeated_overalls ?? null,
    assessment_schema_version: ASSESSMENT_SCHEMA_VERSION,
    prompt_version: PROMPT_ENGINE_VERSION,
    model_version: opts.model_version ?? null,
    rubric_version: RUBRIC_SCHEMA_VERSION,
  };
}

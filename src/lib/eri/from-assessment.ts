/**
 * Build ERI input from assessment scores + optional ACE coach / psychometrics.
 */

import type { ScoreEntry } from "@/lib/types";
import type { CoachFeedback } from "@/lib/ace/types";
import type { EriComputeInput } from "@/lib/eri/types";
import { simulateInterRaterAgreement } from "@/lib/eri/engine";
import {
  ACE_ENGINE_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  CGE_ENGINE_VERSION,
  PROMPT_ENGINE_VERSION,
  RUBRIC_SCHEMA_VERSION,
} from "@/lib/scientific/versions";
import { RUBRIC_TO_COMPETENCIES } from "@/lib/ace/catalog";

export function eriInputFromAssessment(opts: {
  overall: number;
  items: ScoreEntry[];
  narrative?: string | null;
  excerpts?: string[] | null;
  locale: string;
  difficulty?: string | null;
  assessment_mode?: EriComputeInput["assessment_mode"];
  coach?: CoachFeedback | null;
  learning_objectives_count?: number;
  difficulty_matches_learner?: boolean | null;
  inter_session_r?: number | null;
  test_retest_r?: number | null;
  cronbach_alpha?: number | null;
  fairness_pass?: boolean | null;
  language_parity_within_tolerance?: boolean | null;
  language_parity_abs_diff?: number | null;
  learner_id?: string | null;
  session_id?: string | null;
  model_version?: string | null;
  seed?: number;
}): EriComputeInput {
  const items = opts.items ?? [];
  const feedbacks = items.map((i) => (i.feedback ?? "").trim());
  const withFb = feedbacks.filter((f) => f.length > 0 && !/^no feedback/i.test(f) && f !== "sim");
  const meanChars = withFb.length
    ? withFb.reduce((a, f) => a + f.length, 0) / withFb.length
    : 0;

  const scores01to5 = items.map((i) => {
    const max = i.max || 5;
    return (i.score / max) * 5;
  });
  const irr = scores01to5.length
    ? simulateInterRaterAgreement(scores01to5, 0.45, opts.seed ?? 42)
    : { r: null, pct_agree: 0 };

  const mapped = new Set<string>();
  for (const item of items) {
    const comps = RUBRIC_TO_COMPETENCIES[item.id];
    if (comps) for (const c of comps) mapped.add(c);
  }

  const coach = opts.coach;
  const remediationSteps = coach?.improvement_plan
    ? coach.improvement_plan.split(/\n/).filter((l) => l.trim().length > 0).length
    : 0;

  return {
    locale: opts.locale,
    difficulty: opts.difficulty ?? null,
    assessment_mode: opts.assessment_mode ?? null,
    overall_score: opts.overall,
    item_count: items.length,
    items_with_feedback: withFb.length,
    mean_feedback_chars: meanChars,
    narrative_chars: (opts.narrative ?? "").length,
    excerpt_count: opts.excerpts?.length ?? 0,
    learning_objectives_count: opts.learning_objectives_count ?? 0,
    competencies_mapped: mapped.size,
    supervisor_feedback_chars: coach?.supervisor_feedback?.length ?? 0,
    reflective_questions_count: coach?.reflective_questions?.length ?? 0,
    learning_goals_count: coach?.learning_goals?.length ?? 0,
    remediation_steps: remediationSteps,
    missed_opportunities_count: coach?.missed_opportunities?.length ?? 0,
    suggested_next_cases_count: coach?.suggested_next_cases?.length ?? 0,
    suggested_reading_count: coach?.suggested_reading?.length ?? 0,
    difficulty_matches_learner: opts.difficulty_matches_learner ?? null,
    inter_session_r: opts.inter_session_r ?? null,
    inter_rater_r: irr.r,
    inter_rater_pct_agree: irr.pct_agree,
    test_retest_r: opts.test_retest_r ?? null,
    cronbach_alpha: opts.cronbach_alpha ?? null,
    fairness_pass: opts.fairness_pass ?? null,
    language_parity_within_tolerance:
      opts.language_parity_within_tolerance ?? null,
    language_parity_abs_diff: opts.language_parity_abs_diff ?? null,
    learner_id: opts.learner_id ?? null,
    session_id: opts.session_id ?? null,
    assessment_version: ASSESSMENT_SCHEMA_VERSION,
    rubric_version: RUBRIC_SCHEMA_VERSION,
    competency_graph_version: CGE_ENGINE_VERSION,
    adaptive_curriculum_version: ACE_ENGINE_VERSION,
    prompt_version: PROMPT_ENGINE_VERSION,
    model_version: opts.model_version ?? null,
  };
}

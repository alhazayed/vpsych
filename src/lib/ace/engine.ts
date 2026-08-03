/**
 * Adaptive Curriculum Engine — orchestration surface.
 */

import { COMPETENCY_IDS } from "./catalog";
import {
  applySessionPerformance,
  buildAnalytics,
  mapRubricToCompetencies,
} from "./analytics";
import {
  detectRepetitionLoop,
  generateAdaptiveCase,
  selectActiveRules,
} from "./adaptive";
import {
  advanceCurriculum,
  generateCurriculum,
  generateLearningPlan,
} from "./curriculum";
import { generateSupervisorFeedback } from "./coach";
import { updateCertificationStatus } from "./certifications";
import type {
  AdaptiveCaseRequest,
  CoachFeedback,
  LearnerCompetency,
  LearnerProfile,
  LearningPath,
  LearningPlan,
  PerformanceAnalytics,
  SessionPerformanceInput,
} from "./types";
import type { ScoreEntry } from "@/lib/types";

export function createEmptyCompetencies(): LearnerCompetency[] {
  // Neutral baseline at threshold — remediation requires assessed samples.
  return COMPETENCY_IDS.map((id) => ({
    competency_id: id,
    score: 70,
    samples: 0,
    trend: 0,
  }));
}

export function createLearnerProfile(input: {
  id?: string;
  user_id: string;
  training_level?: LearnerProfile["training_level"];
  profession?: LearnerProfile["profession"];
  language?: string;
  institution?: string | null;
}): LearnerProfile {
  return {
    id: input.id ?? `learner-${input.user_id}`,
    user_id: input.user_id,
    training_level: input.training_level ?? "residency",
    profession: input.profession ?? "psychiatry_resident",
    institution: input.institution ?? null,
    language: input.language ?? "en-US",
    preferred_therapy_models: ["cbt", "supportive"],
    adaptive_mode: true,
    curriculum_mode: "automatic",
    min_competency_threshold: 70,
    max_difficulty: "expert",
    locked_diagnoses: [],
    locked_objectives: [],
    required_competencies: [],
    optional_competencies: [],
    completed_case_count: 0,
    learning_velocity: 0,
    confidence_score: 50,
    certification_status: "not_started",
    competencies: createEmptyCompetencies(),
    metadata: {},
  };
}

export function ingestSessionAssessment(
  profile: LearnerProfile,
  opts: {
    overall: number;
    items: ScoreEntry[];
    sessionId?: string;
    diagnosisSlug?: string | null;
    correctDiagnosis?: boolean;
    missFlags?: SessionPerformanceInput["missFlags"];
    narrative?: string;
    durationSec?: number;
    timeLimitSec?: number;
  },
): {
  profile: LearnerProfile;
  performance: SessionPerformanceInput;
  coach: CoachFeedback;
  analytics: PerformanceAnalytics;
  nextCase: AdaptiveCaseRequest;
  path: LearningPath;
} {
  const competencyScores = mapRubricToCompetencies(opts.items, opts.overall);
  const performance: SessionPerformanceInput = {
    sessionId: opts.sessionId,
    overallScore: opts.overall,
    competencyScores,
    diagnosisSlug: opts.diagnosisSlug,
    correctDiagnosis: opts.correctDiagnosis,
    missFlags: opts.missFlags,
    durationSec: opts.durationSec,
    timeLimitSec: opts.timeLimitSec,
  };

  let next = applySessionPerformance(profile, performance);
  next = updateCertificationStatus(next);

  const coach = generateSupervisorFeedback(next, performance);

  const priorCompleted =
    ((profile.metadata?.completed_diagnoses as string[]) ?? []).filter(Boolean);
  const priorMissed =
    ((profile.metadata?.missed_diagnoses as string[]) ?? []).filter(Boolean);
  const sessionCompleted =
    opts.correctDiagnosis === false
      ? []
      : opts.correctDiagnosis === true && opts.diagnosisSlug
        ? [opts.diagnosisSlug]
        : [];
  const sessionMissed =
    opts.correctDiagnosis === false && opts.diagnosisSlug
      ? [opts.diagnosisSlug]
      : [];
  const completedDiagnoses = [...new Set([...priorCompleted, ...sessionCompleted])];
  const missedDiagnoses = [...new Set([...priorMissed, ...sessionMissed])].filter(
    (d) => !completedDiagnoses.includes(d),
  );

  const analytics = buildAnalytics(
    next,
    [
      ...((profile.metadata?.history_overall as number[]) ?? []),
      opts.overall,
    ],
    completedDiagnoses,
    missedDiagnoses,
  );

  let path = generateCurriculum(next);
  const focusScore =
    next.competencies.find(
      (c) => c.competency_id === path.focus_competency_id,
    )?.score ?? opts.overall;
  path = advanceCurriculum(path, focusScore, next.min_competency_threshold);

  const nextCase = generateAdaptiveCase(next, {
    seed: `next:${next.id}:${next.completed_case_count}`,
    stepIndex: path.current_step,
  });

  next = {
    ...next,
    metadata: {
      ...next.metadata,
      history_overall: analytics.learning_curve.map((p) => p.overall),
      completed_diagnoses: completedDiagnoses,
      missed_diagnoses: missedDiagnoses,
      last_next_case: nextCase,
      active_rules: selectActiveRules(next).map((r) => r.slug),
    },
  };

  return { profile: next, performance, coach, analytics, nextCase, path };
}

export function getLearningPlan(profile: LearnerProfile): LearningPlan {
  return generateLearningPlan(profile);
}

export {
  generateAdaptiveCase,
  generateCurriculum,
  generateLearningPlan,
  generateSupervisorFeedback,
  buildAnalytics,
  detectRepetitionLoop,
  selectActiveRules,
  mapRubricToCompetencies,
};

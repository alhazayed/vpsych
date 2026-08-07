/**
 * Supervisor Engine — orchestrates Stage 9 review pipeline.
 * Observes only. Never writes patient clinical state.
 */

import { evaluateSupervisorCertification } from "@/lib/supervisor/certification-engine";
import { buildCompetencyProgression } from "@/lib/supervisor/competency-engine";
import { buildExpertReview } from "@/lib/supervisor/expert-review";
import { generateSupervisionFeedback } from "@/lib/supervisor/feedback-generator";
import { generateLearningRecommendations } from "@/lib/supervisor/learning-recommendations";
import { buildSupervisorPortfolio } from "@/lib/supervisor/portfolio-engine";
import {
  buildProgressGraph,
  buildProgressSnapshot,
} from "@/lib/supervisor/progress-engine";
import { buildReflectivePractice } from "@/lib/supervisor/reflective-practice";
import { buildSupervisorVersionLock } from "@/lib/supervisor/versions";
import type {
  SupervisorDashboard,
  SupervisorRunInput,
  SupervisorSessionBundle,
} from "@/lib/supervisor/types";
import {
  SUPERVISOR_FRAMEWORK_VERSION,
  SUPERVISOR_VERSION,
} from "@/lib/supervisor/types";
import { weightedTherapistOverall } from "@/lib/supervisor/therapist-evaluation";

export function runSupervisorEngine(
  input: SupervisorRunInput,
): SupervisorSessionBundle {
  const expert_review = buildExpertReview(input);
  const feedback = generateSupervisionFeedback(
    expert_review,
    input.learnerProfile,
  );
  const competencies = buildCompetencyProgression(expert_review.skill_scores);
  const recommendations = generateLearningRecommendations(expert_review);
  const certification = evaluateSupervisorCertification({
    review: expert_review,
    profile: input.learnerProfile,
    feedbackBand: feedback.primary.band,
  });
  const progress = buildProgressSnapshot({
    review: expert_review,
    priorSkillScores: input.priorSkillScores,
    sessionsReviewed: input.learnerProfile?.completed_case_count ?? 1,
  });
  const portfolio = buildSupervisorPortfolio({
    profile: input.learnerProfile,
    userId: input.userId,
    review: expert_review,
    competencyEntries: competencies.entries,
    certification,
    diagnosisSlug: input.diagnosisSlug ?? null,
    caseModality: input.clinicalSnapshot?.therapy_modality ?? null,
    overall: input.overall,
  });
  const reflective = buildReflectivePractice({
    review: expert_review,
    snapshot: input.clinicalSnapshot,
  });

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    supervisor_version: SUPERVISOR_VERSION,
    session_id: input.sessionId,
    expert_review,
    feedback,
    competencies,
    recommendations,
    certification,
    progress,
    portfolio,
    reflective,
    versions: buildSupervisorVersionLock(),
  };
}

export function buildSupervisorDashboard(input: {
  bundle: SupervisorSessionBundle | null;
  historyOveralls?: number[];
}): SupervisorDashboard {
  const bundle = input.bundle;
  const quality_gate_notes = [
    "Supervisor evaluates therapists — not patients.",
    "Never invents diagnoses or evidence.",
    "Uses Stage 8 validation metrics when present as observational grounding only.",
    "Does not write clinical_snapshot, case_memory, LTM, DecisionPlan, or patient prompts.",
  ];

  if (!bundle) {
    return {
      version: SUPERVISOR_FRAMEWORK_VERSION,
      portfolio: {
        version: SUPERVISOR_FRAMEWORK_VERSION,
        learner_id: "unknown",
        user_id: "unknown",
        case_log: [],
        competency_log: [],
        strength_evolution: [],
        weakness_evolution: [],
        milestones: [],
        certification: {
          current_band: "beginner",
          progress_pct: 0,
          milestones_met: [],
          milestones_pending: ["Complete a supervised session"],
          board_ready: false,
          rationale: ["No supervisor bundle yet."],
        },
        updated_at: new Date().toISOString(),
      },
      competency_heatmap: [],
      progress_graph: [],
      certification_tracker: {
        current_band: "beginner",
        progress_pct: 0,
        milestones_met: [],
        milestones_pending: ["Complete a supervised session"],
        board_ready: false,
        rationale: ["No data"],
      },
      longitudinal: {
        sessions_reviewed: 0,
        overall_ema: 0,
        skill_trends: [],
        plateau: false,
        regression: false,
        velocity: 0,
      },
      latest_session: null,
      quality_gate_notes,
    };
  }

  const history = input.historyOveralls?.length
    ? input.historyOveralls
    : [weightedTherapistOverall(bundle.expert_review.skill_scores)];

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    portfolio: bundle.portfolio,
    competency_heatmap: bundle.competencies.heatmap,
    progress_graph: buildProgressGraph(history.map((overall) => ({ overall }))),
    certification_tracker: bundle.certification,
    longitudinal: bundle.progress,
    latest_session: bundle,
    quality_gate_notes,
  };
}

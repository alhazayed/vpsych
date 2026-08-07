/**
 * Expert Review Engine — composes skill scores, modalities, domain reports.
 */

import {
  buildClinicalSupervisor,
  buildCommunicationSupervisor,
  buildDsmSupervisor,
  buildPsychotherapySupervisor,
  buildRiskSupervisor,
} from "@/lib/supervisor/domain-supervisors";
import { detectModalities } from "@/lib/supervisor/modality-detector";
import { buildSessionReview } from "@/lib/supervisor/session-review";
import { evaluateTherapistSkills } from "@/lib/supervisor/therapist-evaluation";
import type {
  ExpertReviewReport,
  SupervisorRunInput,
} from "@/lib/supervisor/types";
import { SUPERVISOR_FRAMEWORK_VERSION } from "@/lib/supervisor/types";
import { analyzeInterviewProcess } from "@/lib/education";

export function buildExpertReview(input: SupervisorRunInput): ExpertReviewReport {
  const process =
    input.educationEvaluation?.process ??
    analyzeInterviewProcess(input.messages);

  const skill_scores = evaluateTherapistSkills({
    messages: input.messages,
    items: input.items,
    overall: input.overall,
    process,
    aceCompetencies: input.learnerProfile?.competencies,
  });

  const modalities_observed = detectModalities({
    messages: input.messages,
    caseModality: input.clinicalSnapshot?.therapy_modality ?? null,
  });

  const diagnostic =
    input.educationDiagnostic ?? input.educationBundle?.diagnostic ?? null;

  const session_review = buildSessionReview({
    sessionId: input.sessionId,
    skillScores: skill_scores,
    modalities: modalities_observed,
    evaluation: input.educationEvaluation ?? input.educationBundle?.evaluation,
    diagnostic,
    snapshot: input.clinicalSnapshot,
    educationFeedback: input.educationFeedback ?? input.educationBundle?.feedback,
  });

  const domain_reports = [
    buildClinicalSupervisor(skill_scores, diagnostic),
    buildCommunicationSupervisor(skill_scores),
    buildPsychotherapySupervisor(skill_scores, modalities_observed),
    buildRiskSupervisor(skill_scores),
    buildDsmSupervisor(skill_scores, diagnostic, input.clinicalSnapshot),
  ];

  const weak = skill_scores.filter((s) => s.score < 55).length;
  const strong = skill_scores.filter((s) => s.score >= 75).length;
  const overall_impression = `Expert review: ${strong} strength skill(s), ${weak} growth area(s). Supervision is educational only and does not change patient state.`;

  const validation_metrics = input.validationRun?.metrics ?? null;

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    overall_impression,
    skill_scores,
    modalities_observed,
    session_review,
    domain_reports,
    validation_metrics,
  };
}

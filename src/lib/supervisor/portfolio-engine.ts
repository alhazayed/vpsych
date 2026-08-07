/**
 * Portfolio Engine — case log, competency log, strength/weakness evolution.
 */

import type {
  CompetencyProgressionEntry,
  ExpertReviewReport,
  PortfolioCaseLogEntry,
  SupervisorPortfolio,
  TherapistSkillId,
} from "@/lib/supervisor/types";
import { SUPERVISOR_FRAMEWORK_VERSION } from "@/lib/supervisor/types";
import type { CertificationProgress } from "@/lib/supervisor/types";
import type { LearnerProfile } from "@/lib/ace/types";
import { recognizedFromCase } from "@/lib/supervisor/modality-detector";
import type { TherapyModality } from "@/lib/case-engine/types";

export function buildSupervisorPortfolio(input: {
  profile?: LearnerProfile | null;
  userId: string;
  review: ExpertReviewReport;
  competencyEntries: CompetencyProgressionEntry[];
  certification: CertificationProgress;
  priorCaseLog?: PortfolioCaseLogEntry[];
  diagnosisSlug?: string | null;
  caseModality?: TherapyModality | null;
  overall: number;
}): SupervisorPortfolio {
  const learner_id = input.profile?.id ?? `supervisor:${input.userId}`;
  const strong = input.review.skill_scores
    .filter((s) => s.score >= 75)
    .map((s) => s.id.replace(/_/g, " "));
  const weak = input.review.skill_scores
    .filter((s) => s.score < 55)
    .map((s) => s.id.replace(/_/g, " "));

  const entry: PortfolioCaseLogEntry = {
    session_id: input.review.session_review.session_id,
    diagnosis_slug: input.diagnosisSlug ?? null,
    modalities: input.review.modalities_observed
      .filter((m) => m.modality !== "unknown")
      .map((m) => m.modality),
    overall: input.overall,
    strengths: strong.slice(0, 5),
    weaknesses: weak.slice(0, 5),
    reviewed_at: new Date().toISOString(),
  };

  if (entry.modalities.length === 0 && input.caseModality) {
    entry.modalities = [recognizedFromCase(input.caseModality)];
  }

  const case_log = [...(input.priorCaseLog ?? []), entry].slice(-50);

  const bySkill = new Map<TherapistSkillId, number[]>();
  for (const e of input.competencyEntries) {
    bySkill.set(e.skill_id, [e.score]);
  }

  const strength_evolution = input.competencyEntries
    .filter((e) => e.score >= 70)
    .map((e) => ({ skill: e.skill_id, scores: bySkill.get(e.skill_id) ?? [e.score] }));

  const weakness_evolution = input.competencyEntries
    .filter((e) => e.score < 60)
    .map((e) => ({ skill: e.skill_id, scores: bySkill.get(e.skill_id) ?? [e.score] }));

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    learner_id,
    user_id: input.userId,
    case_log,
    competency_log: input.competencyEntries,
    strength_evolution,
    weakness_evolution,
    milestones: [
      ...input.certification.milestones_met,
      `Band: ${input.certification.current_band}`,
    ],
    certification: input.certification,
    updated_at: new Date().toISOString(),
  };
}

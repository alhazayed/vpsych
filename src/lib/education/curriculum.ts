/**
 * Curriculum + Learning Path façades over ACE + CGE.
 * Does not replace ACE generateCurriculum / CGE remediation — composes them.
 */

import { generateCurriculum, generateLearningPlan } from "@/lib/ace/curriculum";
import { generateAdaptiveCase } from "@/lib/ace/adaptive";
import type {
  AdaptiveCaseRequest,
  LearnerProfile,
  LearningPath,
} from "@/lib/ace/types";
import {
  generateLearningPathFromGraph,
  statesFromAceCompetencies,
} from "@/lib/cge/engine";
import { buildDifficultyProfile } from "@/lib/education/difficulty";
import type {
  DifficultyProfile,
  ExpertFeedbackReport,
} from "@/lib/education/types";

export type EducationCurriculumPlan = {
  ace_path: LearningPath;
  cge_steps: string[];
  difficulty: DifficultyProfile;
  next_case: AdaptiveCaseRequest;
  micro_skills: string[];
  reading: string[];
  practice_focus: string[];
};

export function generateEducationCurriculum(
  profile: LearnerProfile,
  feedback?: ExpertFeedbackReport | null,
): EducationCurriculumPlan {
  const difficulty = buildDifficultyProfile(profile);
  const ace_path = generateCurriculum(profile);
  const states = statesFromAceCompetencies(profile.competencies);
  const cgePlan = generateLearningPathFromGraph(profile.id, states);
  const next_case = generateAdaptiveCase(profile, {
    seed: `edu-next:${profile.id}:${profile.completed_case_count}`,
  });
  next_case.difficulty = difficulty.case_difficulty;

  const micro_skills = [
    ...(feedback?.priority_improvements.slice(0, 3) ?? []),
    ...ace_path.steps
      .slice(ace_path.current_step, ace_path.current_step + 2)
      .flatMap((s) => s.focus.map((f) => f.replace(/_/g, " "))),
    ...(cgePlan.pathway ?? []).slice(0, 2).map((s) => s.title),
  ].slice(0, 6);

  const plan = generateLearningPlan(profile);

  return {
    ace_path,
    cge_steps: (cgePlan.pathway ?? []).map((s) => s.title),
    difficulty,
    next_case,
    micro_skills,
    reading: feedback?.evidence_based_references.slice(0, 5) ?? [],
    practice_focus: plan.primary_focus
      ? [plan.primary_focus.replace(/_/g, " ")]
      : ace_path.steps[ace_path.current_step]?.focus.map((f) =>
          f.replace(/_/g, " "),
        ) ?? [],
  };
}

/**
 * Teaching Engine — micro-skill prompts for trainees (never patient-facing).
 */

import type { EducationCompetencyDomainId, ExpertFeedbackReport } from "@/lib/education/types";

const MICRO: Partial<Record<EducationCompetencyDomainId, string[]>> = {
  risk_assessment: [
    "Ask ideation, plan, intent, means, protective factors in that order.",
    "Document risk and protectives explicitly before closing.",
  ],
  reflective_listening: [
    "Reflect feeling + content in one sentence before the next question.",
  ],
  question_quality: [
    "Aim for ≥50% open questions in the first half of the interview.",
  ],
  mental_state_examination: [
    "Cover mood, affect, thought process/content, perception, insight, judgement.",
  ],
  differential_diagnosis: [
    "Name two differentials aloud and one rule-out question for each.",
  ],
  empathy: [
    "Validate before advice or psychoeducation.",
  ],
  session_structure: [
    "Agenda → explore → risk → summary → next steps.",
  ],
};

export function microSkillsFor(
  domains: EducationCompetencyDomainId[],
): string[] {
  const out: string[] = [];
  for (const d of domains) {
    for (const line of MICRO[d] ?? []) out.push(line);
  }
  return out.slice(0, 8);
}

export function teachingPlanFromFeedback(
  feedback: ExpertFeedbackReport,
): string[] {
  const domains = feedback.weaknesses
    .map((w) => {
      const key = w.toLowerCase().replace(/\s+/g, "_");
      return key as EducationCompetencyDomainId;
    })
    .slice(0, 5);
  return [
    ...feedback.priority_improvements.slice(0, 3),
    ...microSkillsFor(domains),
  ].slice(0, 8);
}

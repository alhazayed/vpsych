/**
 * Maps learning objectives → candidate disorder slugs.
 * The engine selects among these; instructors do not pick diagnoses
 * unless Advanced Mode is enabled.
 */

import type { LearningObjectiveKey } from "@/lib/instructor-presets/types";

export const OBJECTIVE_DISORDER_CANDIDATES: Record<
  LearningObjectiveKey,
  string[]
> = {
  diagnostic_interview: [
    "mdd-recurrent-moderate",
    "gad-with-panic",
    "ptsd",
    "panic-disorder",
    "adult-adhd",
  ],
  mental_status_examination: [
    "mdd-recurrent-moderate",
    "gad-with-panic",
    "schizophrenia",
    "bipolar-mania",
  ],
  risk_assessment: [
    "mdd-recurrent-moderate",
    "bpd",
    "ptsd",
    "bipolar-mania",
    "alcohol-use-disorder",
  ],
  suicide_assessment: [
    "mdd-recurrent-moderate",
    "bpd",
    "ptsd",
    "alcohol-use-disorder",
  ],
  violence_risk_assessment: ["bipolar-mania", "schizophrenia", "bpd"],
  differential_diagnosis: [
    "mdd-recurrent-moderate",
    "gad-with-panic",
    "bipolar-mania",
    "adult-adhd",
  ],
  medication_review: [
    "mdd-recurrent-moderate",
    "schizophrenia",
    "bipolar-mania",
    "adult-adhd",
  ],
  medication_counseling: ["mdd-recurrent-moderate", "gad-with-panic"],
  medication_side_effects: ["mdd-recurrent-moderate", "schizophrenia"],
  cbt_skills: ["mdd-recurrent-moderate", "gad-with-panic", "panic-disorder"],
  dbt_skills: ["bpd", "ptsd"],
  act_skills: ["mdd-recurrent-moderate", "gad-with-panic"],
  psychodynamic_interview: ["mdd-recurrent-moderate", "bpd"],
  motivational_interviewing: ["alcohol-use-disorder", "mdd-recurrent-moderate"],
  supportive_psychotherapy: ["mdd-recurrent-moderate", "gad-with-panic", "ptsd"],
  trauma_assessment: ["ptsd", "bpd"],
  substance_use_assessment: ["alcohol-use-disorder", "mdd-recurrent-moderate"],
  adhd_assessment: ["adult-adhd", "gad-with-panic"],
  autism_assessment: ["adult-adhd"], // ASD package may be DB-only; ADHD as fallback candidate
  personality_assessment: ["bpd", "mdd-recurrent-moderate"],
  family_assessment: ["mdd-recurrent-moderate", "bpd"],
  breaking_bad_news: ["mdd-recurrent-moderate"],
  shared_decision_making: ["mdd-recurrent-moderate", "gad-with-panic"],
  psychoeducation: ["mdd-recurrent-moderate", "gad-with-panic", "adult-adhd"],
  treatment_planning: [
    "mdd-recurrent-moderate",
    "gad-with-panic",
    "ptsd",
    "adult-adhd",
  ],
  termination_session: ["mdd-recurrent-moderate", "gad-with-panic"],
  relapse_prevention: ["mdd-recurrent-moderate", "alcohol-use-disorder"],
  crisis_intervention: [
    "mdd-recurrent-moderate",
    "bpd",
    "ptsd",
    "bipolar-mania",
  ],
  emergency_psychiatry: [
    "bipolar-mania",
    "schizophrenia",
    "mdd-recurrent-moderate",
    "ptsd",
  ],
  osce_examination: [
    "mdd-recurrent-moderate",
    "gad-with-panic",
    "ptsd",
    "panic-disorder",
  ],
};

/** Preferred clinical template slugs by primary objective. */
export const OBJECTIVE_TEMPLATE_PREFERENCES: Partial<
  Record<LearningObjectiveKey, string[]>
> = {
  suicide_assessment: ["ptsd-risk-assessment-en", "adult-mdd-initial-en"],
  risk_assessment: ["ptsd-risk-assessment-en", "adult-mdd-initial-en"],
  crisis_intervention: ["ptsd-risk-assessment-en"],
  emergency_psychiatry: ["ptsd-risk-assessment-en"],
  osce_examination: ["adult-gad-osce-ar", "adult-mdd-initial-en"],
  cbt_skills: ["adult-mdd-initial-en", "adult-gad-osce-ar"],
  diagnostic_interview: ["adult-mdd-initial-en", "adult-gad-osce-ar"],
  trauma_assessment: ["ptsd-risk-assessment-en"],
  dbt_skills: ["ptsd-risk-assessment-en", "adult-mdd-initial-en"],
};

export function candidatesForObjectives(
  primary: LearningObjectiveKey,
  secondary: LearningObjectiveKey[] = [],
): string[] {
  const sets = [primary, ...secondary].map(
    (o) => new Set(OBJECTIVE_DISORDER_CANDIDATES[o] ?? []),
  );
  if (sets.length === 0) return [];
  // Prefer intersection of primary with each secondary; fall back to primary only
  let result = [...sets[0]!];
  for (let i = 1; i < sets.length; i++) {
    const next = result.filter((d) => sets[i]!.has(d));
    if (next.length > 0) result = next;
  }
  return result;
}

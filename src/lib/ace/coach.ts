import { scoreOf } from "./catalog";
import { generateAdaptiveCase } from "./adaptive";
import type {
  CoachFeedback,
  CompetencyId,
  LearnerProfile,
  SessionPerformanceInput,
} from "./types";

export function generateSupervisorFeedback(
  profile: LearnerProfile,
  performance: SessionPerformanceInput,
): CoachFeedback {
  const threshold = profile.min_competency_threshold;
  const weak = [...profile.competencies]
    .filter((c) => c.samples > 0 && c.score < threshold)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const strengths = [...profile.competencies]
    .filter((c) => c.samples > 0 && c.score >= 80)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const focus = weak[0]?.competency_id ?? "diagnostic_interview";
  const next = generateAdaptiveCase(profile, {
    seed: `coach:${profile.id}:${performance.sessionId ?? "x"}`,
  });

  const missed: string[] = [];
  const flags = performance.missFlags ?? {};
  if (flags.missed_suicide_questions) {
    missed.push("Did not complete structured suicide risk inquiry");
  }
  if (flags.missed_violence_assessment) {
    missed.push("Missed violence / harm-to-others screening");
  }
  if (flags.missed_substance_screening) {
    missed.push("Missed substance use screening");
  }
  if (flags.missed_trauma_assessment) {
    missed.push("Missed trauma assessment opportunity");
  }
  if (flags.missed_bipolar_screening) {
    missed.push("Missed bipolar / mania screen before antidepressant discussion");
  }
  if (flags.missed_psychosis_screening) {
    missed.push("Missed psychosis screen");
  }
  if (flags.missed_dsm_criteria) {
    missed.push("Incomplete DSM criteria coverage");
  }
  if (flags.incorrect_medications) {
    missed.push("Medication decision not aligned with presentation");
  }
  if (performance.correctDiagnosis === false) {
    missed.push("Primary diagnosis not correctly identified");
  }
  if (!missed.length && performance.overallScore < threshold) {
    missed.push(
      `Overall performance below threshold on ${focus.replace(/_/g, " ")}`,
    );
  }

  const supervisor_feedback = [
    `Overall session score: ${Math.round(performance.overallScore)}/100.`,
    strengths.length
      ? `Strengths: ${strengths.map((s) => s.competency_id.replace(/_/g, " ")).join(", ")}.`
      : "Keep building foundational interview structure.",
    weak.length
      ? `Priority growth areas: ${weak.map((w) => `${w.competency_id.replace(/_/g, " ")} (${w.score})`).join("; ")}.`
      : "Competencies are at or above threshold — prepare for more complex presentations.",
    `Next case will target: ${next.focusCompetencies.join(", ").replace(/_/g, " ")} (${next.disorderSlug}, ${next.difficulty}).`,
  ].join(" ");

  const reflective_questions = [
    `What cue might you have missed related to ${focus.replace(/_/g, " ")}?`,
    "If you repeated this interview, what would you ask in the first 5 minutes?",
    "How did alliance affect disclosure — what would you do differently?",
  ];

  const learning_goals = [
    `Raise ${focus.replace(/_/g, " ")} to ≥ ${threshold}`,
    ...weak.slice(1, 2).map(
      (w) => `Practice ${w.competency_id.replace(/_/g, " ")} deliberately`,
    ),
  ];

  const improvement_plan = [
    `1. Complete ${Math.max(2, Math.ceil((threshold - scoreOf(profile.competencies, focus as CompetencyId)) / 8))} focused cases on ${focus.replace(/_/g, " ")}.`,
    "2. Use a structured checklist before ending each session (risk, differentials, MSE).",
    "3. Review coach suggested reading and annotate one takeaway per case.",
    performance.overallScore < 50
      ? "4. Enable hints / coaching on the next practice case (scaffold mode)."
      : "4. After two solid sessions, invite increased diagnostic ambiguity.",
  ].join("\n");

  return {
    supervisor_feedback,
    reflective_questions,
    missed_opportunities: missed,
    suggested_reading: readingFor(focus as CompetencyId),
    suggested_next_cases: [
      next.rationale,
      `${next.disorderSlug} @ ${next.difficulty}`,
      ...(next.adaptations.slice(0, 3) || []),
    ],
    learning_goals,
    improvement_plan,
  };
}

function readingFor(focus: CompetencyId): string[] {
  const map: Partial<Record<CompetencyId, string[]>> = {
    suicide_assessment: [
      "C-SSRS",
      "SAFE-T",
      "APA Suicidal Behaviors guideline summary",
    ],
    differential_diagnosis: [
      "DSM-5-TR differential trees",
      "Medical mimics in psychiatry primer",
    ],
    cbt_skills: ["Beck CT basics", "Agenda setting & homework troubleshooting"],
    risk_assessment: ["Structured risk formulation worksheet"],
    empathy: ["Motivational interviewing — OARS pocket guide"],
  };
  return (
    map[focus] ?? [
      "Clinical interviewing skills checklist",
      "Relevant APA practice guideline module",
    ]
  );
}

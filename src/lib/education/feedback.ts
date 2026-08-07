/**
 * Expert feedback + teaching — façades over ACE coach + session evaluation.
 * Educational only; never edits patient replies.
 */

import type { CoachFeedback } from "@/lib/ace/types";
import type {
  DiagnosticReasoningReport,
  ExpertFeedbackReport,
  SessionEvaluationReport,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION } from "@/lib/education/types";

const WORDING: ExpertFeedbackReport["suggested_wording"] = [
  {
    instead_of: "You should just…",
    try: "What would it be like if we looked at one small step together?",
    why: "Preserves autonomy; MI-congruent.",
  },
  {
    instead_of: "Are you suicidal?",
    try: "When things feel this heavy, do you ever have thoughts of ending your life?",
    why: "Direct, normalizing, and clinically clear.",
  },
  {
    instead_of: "I understand exactly how you feel",
    try: "It sounds like this has been exhausting — did I get that right?",
    why: "Accurate empathy without overclaiming.",
  },
  {
    instead_of: "Why didn't you…?",
    try: "Help me understand what got in the way.",
    why: "Reduces shame; invites disclosure.",
  },
];

export function buildExpertFeedback(input: {
  evaluation: SessionEvaluationReport;
  diagnostic: DiagnosticReasoningReport;
  coach: CoachFeedback | null | undefined;
}): ExpertFeedbackReport {
  const coach: CoachFeedback = input.coach ?? {
    supervisor_feedback: "Complete a supervised review of this session.",
    reflective_questions: [
      "What did you learn about the patient's priorities?",
      "Which question would you ask earlier next time?",
    ],
    missed_opportunities: input.evaluation.missed_opportunities,
    suggested_reading: ["APA Practice Guideline summaries (educational)"],
    suggested_next_cases: [],
    learning_goals: input.evaluation.findings
      .filter((f) => f.severity === "major" || f.severity === "critical")
      .slice(0, 3)
      .map((f) => f.title),
    improvement_plan: "Focus next session on the highest-severity findings.",
  };

  const risk_omissions = input.evaluation.findings
    .filter((f) => f.category === "risk_assessment" || f.severity === "critical")
    .map((f) => f.title);

  const diagnostic_gaps = [
    ...input.diagnostic.missing_evidence.slice(0, 4),
    ...(input.diagnostic.contradictory_evidence.slice(0, 2)),
  ];

  const interview_gaps = input.evaluation.findings
    .filter((f) =>
      ["question_quality", "diagnostic_interviewing", "mental_state_examination", "session_structure"].includes(
        f.category,
      ),
    )
    .map((f) => f.title);

  const communication_analysis = [
    `Open questions: ${input.evaluation.process.open_question_count}; closed: ${input.evaluation.process.closed_question_count}`,
    `Reflections: ${input.evaluation.process.reflection_count}; validations: ${input.evaluation.process.validation_count}`,
    `Advice moves: ${input.evaluation.process.advice_count}; leading questions: ${input.evaluation.process.leading_question_count}`,
    `Alliance coverage proxy: ${input.evaluation.coverage.alliance}/100`,
  ];

  const weaknesses = [
    ...input.evaluation.findings
      .filter((f) => f.severity !== "info")
      .map((f) => f.title),
    ...coach.missed_opportunities.slice(0, 3),
  ].slice(0, 8);

  const priority = [
    ...input.evaluation.findings
      .filter((f) => f.severity === "critical" || f.severity === "major")
      .map((f) => f.suggestion ?? f.title),
    ...coach.learning_goals,
    coach.improvement_plan,
  ]
    .filter((s): s is string => Boolean(s && String(s).trim()))
    .slice(0, 5);

  if (!priority.length) {
    priority.push("Consolidate strengths; deepen differentials and risk formulation.");
  }

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    strengths: [
      ...input.evaluation.strengths,
      ...(coach.supervisor_feedback.match(/Strengths:[^.]+/) ?? []),
    ].slice(0, 6),
    weaknesses,
    missed_opportunities: [
      ...new Set([
        ...input.evaluation.missed_opportunities,
        ...coach.missed_opportunities,
      ]),
    ],
    risk_omissions,
    diagnostic_gaps,
    interview_gaps,
    communication_analysis,
    suggested_wording: WORDING,
    alternative_approaches: [
      "Slow down and reflect before the next fact-gathering question.",
      "Use a brief agenda-setting opening to improve session structure.",
      "If risk is present, complete safety planning before psychoeducation.",
      ...input.diagnostic.next_interview_questions.slice(0, 2),
    ],
    priority_improvements: priority,
    evidence_based_references: [
      ...coach.suggested_reading,
      "Educational note: competency scores are not clinically validated instruments.",
    ],
    coach,
  };
}

/** Short teaching block for learner UI — never injected into patient prompts. */
export function formatTeachingBrief(feedback: ExpertFeedbackReport): string {
  return [
    "Expert teaching brief (trainee only — not patient-facing):",
    feedback.priority_improvements.length
      ? `Priority: ${feedback.priority_improvements.join("; ")}`
      : "Priority: consolidate strengths and widen differentials.",
    feedback.missed_opportunities.length
      ? `Missed: ${feedback.missed_opportunities.slice(0, 3).join("; ")}`
      : "",
    feedback.suggested_wording[0]
      ? `Try: "${feedback.suggested_wording[0].try}"`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

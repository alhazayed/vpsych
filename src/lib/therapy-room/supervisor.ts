/**
 * Residency-style supervisor briefing from ACE coach_feedback + nonverbal context.
 * Educational only — never exposes admin session_reports scores/narrative.
 */

import type { PatientNonverbalProfile, SupervisorBriefing } from "./types";

type CoachRow = {
  supervisor_feedback?: string | null;
  reflective_questions?: unknown;
  missed_opportunities?: unknown;
  suggested_reading?: unknown;
  suggested_next_cases?: unknown;
  learning_goals?: unknown;
  improvement_plan?: string | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export function buildSupervisorBriefing(opts: {
  sessionId: string;
  coach: CoachRow | null | undefined;
  nonverbal?: PatientNonverbalProfile | null;
  patientDisplay?: string;
  diagnosisLabel?: string | null;
}): SupervisorBriefing {
  const coach = opts.coach ?? {};
  const missed = asStringArray(coach.missed_opportunities);
  const reading = asStringArray(coach.suggested_reading);
  const goals = asStringArray(coach.learning_goals);
  const questions = asStringArray(coach.reflective_questions);
  const nextCases = asStringArray(coach.suggested_next_cases);
  const nv = opts.nonverbal;

  const whatHappened =
    coach.supervisor_feedback?.trim() ||
    `You completed an outpatient encounter with ${opts.patientDisplay ?? "the patient"}. Let's review process, alliance, and clinical reasoning — not a scorecard.`;

  const whyPatientBehaved = nv
    ? [
        `In the room, expect ${nv.posture}`,
        `Eye contact pattern: ${nv.eyeContact}`,
        `Speech tempo: ${nv.speechTempo}.`,
        `Defences active today: ${nv.defenceMechanisms.join(", ")}.`,
        nv.allianceDevelopment,
        nv.disclosureTiming,
      ].join(" ")
    : opts.diagnosisLabel
      ? `Behaviour followed the ${opts.diagnosisLabel} presentation and session difficulty — not randomness.`
      : "Patient behaviour followed the clinical presentation and alliance state.";

  const strengths = goals.length
    ? goals.map((g) => `You are working toward: ${g}`)
    : [
        "You stayed with the patient through the full clinic visit.",
        "Continuing structured practice builds competency over sessions.",
      ];

  const alternatives = nextCases.length
    ? nextCases.map((c) => `Consider next: ${c}`)
    : [
        "Slow down after affect appears — reflect before the next fact question.",
        "Close with a collaborative agenda and one concrete homework item.",
      ];

  const pearls = [
    "Alliance before agenda when affect rises.",
    "Risk enquiry is a conversation, not a checklist dump.",
    "One accurate feeling reflection often opens more than three clarifying questions.",
  ];

  return {
    sessionId: opts.sessionId,
    whatHappened,
    whyPatientBehaved,
    missedOpportunities: missed.length
      ? missed
      : ["Review whether risk, substances, and trauma gates were opened when indicated."],
    strengths,
    alternativeInterventions: alternatives,
    clinicalPearls: pearls,
    evidenceBasedRecommendations: [
      "Use a structured risk formulation before ending elevated-risk visits.",
      "Match intervention dose to alliance — premature advice hardens resistance.",
    ],
    relevantLiterature: reading.length
      ? reading
      : ["Clinical interviewing skills checklist", "Relevant APA practice guideline module"],
    competencyProgression: goals.length
      ? goals
      : ["Continue deliberate practice on diagnostic interview structure."],
    reflectiveQuestions: questions.length
      ? questions
      : [
          "What cue might you have missed in the first five minutes?",
          "How did alliance affect disclosure — what would you do differently?",
        ],
    improvementPlan:
      coach.improvement_plan?.trim() ||
      "1. Use a structured checklist before ending (risk, differentials, MSE).\n2. Annotate one takeaway per case.\n3. Repeat a focused case on your weakest competency.",
  };
}

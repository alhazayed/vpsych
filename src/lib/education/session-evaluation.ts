/**
 * Session evaluation — educational heuristics over therapist turns.
 * Observes transcript only. Never modifies patient behaviour or snapshot.
 */

import type { ScoreEntry } from "@/lib/types";
import type { LearnerCompetency } from "@/lib/ace/types";
import { mapRubricToCompetencies } from "@/lib/ace/analytics";
import { createEmptyCompetencies } from "@/lib/ace/engine";
import { applySessionPerformance } from "@/lib/ace/analytics";
import type { LearnerProfile } from "@/lib/ace/types";
import {
  scoreEducationCompetencies,
} from "@/lib/education/competency-framework";
import type {
  InterviewProcessSignals,
  SessionEvaluationFinding,
  SessionEvaluationReport,
} from "@/lib/education/types";
import { EDUCATION_FRAMEWORK_VERSION, EDUCATION_VERSION } from "@/lib/education/types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function analyzeInterviewProcess(
  messages: Array<{ role: string; content: string }>,
): InterviewProcessSignals {
  const therapist = messages.filter((m) => m.role === "user");
  let open_question_count = 0;
  let closed_question_count = 0;
  let reflection_count = 0;
  let validation_count = 0;
  let summarization_count = 0;
  let psychoeducation_count = 0;
  let confrontation_count = 0;
  let advice_count = 0;
  let interruption_markers = 0;
  let leading_question_count = 0;
  let risk_inquiry_present = false;
  let mse_probe_present = false;
  let closure_present = false;
  let totalLen = 0;

  for (const turn of therapist) {
    const t = turn.content.trim();
    const lower = t.toLowerCase();
    totalLen += t.length;

    if (/\?/.test(t)) {
      if (/^(did|do|are|is|have|has|was|were|can|could|would)\b/i.test(t)) {
        closed_question_count += 1;
      } else if (/^(what|how|tell me|can you (say|tell)|when)\b/i.test(t)) {
        open_question_count += 1;
      } else {
        open_question_count += 1;
      }
    }
    if (/\b(don't you think|wouldn't you say|surely you)\b/i.test(lower)) {
      leading_question_count += 1;
    }
    if (/\b(what i hear|it sounds like|you're saying|you are saying)\b/i.test(lower)) {
      reflection_count += 1;
    }
    if (/\b(that makes sense|understandable|valid|of course you)\b/i.test(lower)) {
      validation_count += 1;
    }
    if (/\b(to summarize|let me summarize|so far we've|putting this together)\b/i.test(lower)) {
      summarization_count += 1;
    }
    if (/\b(often people|common (pattern|symptom)|psychoeducat|research shows)\b/i.test(lower)) {
      psychoeducation_count += 1;
    }
    if (/\b(i notice you|earlier you said|there('s| is) a (tension|contradiction))\b/i.test(lower)) {
      confrontation_count += 1;
    }
    if (/\b(you should|you need to|just try|why don't you)\b/i.test(lower)) {
      advice_count += 1;
    }
    if (/\b(sorry to interrupt|let me stop you|hold on)\b/i.test(lower)) {
      interruption_markers += 1;
    }
    if (
      /\b(suicid|kill yourself|harm yourself|hurt yourself|ending your life|end your life|safety plan|are you safe|thoughts of (dying|death))\b/i.test(
        lower,
      )
    ) {
      risk_inquiry_present = true;
    }
    if (
      /\b(mood|affect|thought (process|content)|perception|insight|judg(?:e)?ment|mse|mental status)\b/i.test(
        lower,
      )
    ) {
      mse_probe_present = true;
    }
    if (
      /\b(before we (finish|end|stop)|to close|next steps|homework|see you next)\b/i.test(
        lower,
      )
    ) {
      closure_present = true;
    }
  }

  const n = therapist.length || 1;
  return {
    open_question_count,
    closed_question_count,
    reflection_count,
    validation_count,
    summarization_count,
    psychoeducation_count,
    confrontation_count,
    advice_count,
    interruption_markers,
    leading_question_count,
    risk_inquiry_present,
    mse_probe_present,
    closure_present,
    therapist_turn_count: therapist.length,
    avg_therapist_turn_length: Math.round(totalLen / n),
  };
}

export function evaluateSession(input: {
  sessionId: string;
  overall: number;
  items: ScoreEntry[];
  messages: Array<{ role: string; content: string }>;
  aceCompetencies?: LearnerCompetency[];
}): SessionEvaluationReport {
  const process = analyzeInterviewProcess(input.messages);
  const findings: SessionEvaluationFinding[] = [];
  const missed: string[] = [];
  const strengths: string[] = [];

  const openClosedRatio =
    process.open_question_count /
    Math.max(1, process.open_question_count + process.closed_question_count);

  if (openClosedRatio < 0.35 && process.therapist_turn_count >= 4) {
    findings.push({
      id: "leading-closed-heavy",
      severity: "minor",
      category: "question_quality",
      title: "Closed-question heavy interview",
      evidence: `${process.closed_question_count} closed vs ${process.open_question_count} open questions`,
      suggestion: "Lead with open questions; reserve closed items for clarification and risk.",
    });
    missed.push("Insufficient open-ended exploration");
  } else if (openClosedRatio >= 0.55) {
    strengths.push("Healthy open-to-closed question balance");
  }

  if (process.leading_question_count > 0) {
    findings.push({
      id: "leading-questions",
      severity: "major",
      category: "question_quality",
      title: "Leading questions detected",
      evidence: `${process.leading_question_count} leading question marker(s)`,
      suggestion: "Replace leading stems with neutral open inquiry.",
    });
  }

  if (process.advice_count >= 2 && process.validation_count === 0) {
    findings.push({
      id: "premature-advice",
      severity: "major",
      category: "empathy",
      title: "Advice without validation",
      evidence: `${process.advice_count} advice moves; ${process.validation_count} validations`,
      suggestion: "Validate and explore before offering advice or plans.",
    });
    missed.push("Validation before change / advice");
  }

  if (!process.risk_inquiry_present) {
    findings.push({
      id: "missed-risk",
      severity: "critical",
      category: "risk_assessment",
      title: "No explicit risk inquiry",
      evidence: "No suicide/safety probe detected in therapist turns",
      suggestion: "Ask directly about suicidal ideation, plan, intent, and protective factors.",
    });
    missed.push("Risk assessment inquiry");
  } else {
    strengths.push("Risk inquiry present");
  }

  if (!process.mse_probe_present && process.therapist_turn_count >= 5) {
    findings.push({
      id: "thin-mse",
      severity: "minor",
      category: "mental_state_examination",
      title: "Limited MSE probing language",
      evidence: "Few mood/affect/thought/insight probes detected",
      suggestion: "Cover mood, affect, thought process/content, perception, insight, judgement.",
    });
    missed.push("MSE completeness");
  }

  if (process.reflection_count + process.validation_count >= 2) {
    strengths.push("Reflective listening / validation used");
  } else if (process.therapist_turn_count >= 5) {
    findings.push({
      id: "low-reflection",
      severity: "minor",
      category: "reflective_listening",
      title: "Sparse reflection / validation",
      evidence: `reflections=${process.reflection_count}, validations=${process.validation_count}`,
      suggestion: "Reflect feeling and content before gathering more facts.",
    });
  }

  if (!process.closure_present && process.therapist_turn_count >= 6) {
    findings.push({
      id: "weak-closure",
      severity: "info",
      category: "session_structure",
      title: "Session closure not clearly signaled",
      evidence: "No closing / next-steps language detected",
      suggestion: "Summarize, check safety, and agree next steps before ending.",
    });
    missed.push("Structured session closure");
  }

  if (process.interruption_markers > 0) {
    findings.push({
      id: "interruptions",
      severity: "minor",
      category: "rapport",
      title: "Interruption markers",
      evidence: `${process.interruption_markers} interruption cue(s)`,
      suggestion: "Allow silence; interrupt only for safety or severe derailment.",
    });
  }

  // Rubric → temporary ACE rows → education domain scores (in-memory only)
  const mapped = mapRubricToCompetencies(input.items, input.overall);
  let comps = input.aceCompetencies;
  if (!comps?.length) {
    const empty = createEmptyCompetencies();
    const stub = {
      id: "tmp",
      user_id: "tmp",
      training_level: "residency" as const,
      profession: "psychiatry_resident" as const,
      language: "en",
      preferred_therapy_models: [],
      adaptive_mode: true,
      curriculum_mode: "automatic" as const,
      min_competency_threshold: 70,
      max_difficulty: "advanced" as const,
      locked_diagnoses: [],
      locked_objectives: [],
      required_competencies: [],
      optional_competencies: [],
      completed_case_count: 0,
      learning_velocity: 0,
      confidence_score: 50,
      certification_status: "not_started" as const,
      competencies: empty,
    } satisfies LearnerProfile;
    comps = applySessionPerformance(stub, {
      overallScore: input.overall,
      competencyScores: mapped,
      sessionId: input.sessionId,
    }).competencies;
  }

  const competency_scores = scoreEducationCompetencies(comps);

  const coverage = {
    information_gathering: clamp(
      (process.open_question_count * 12 +
        (competency_scores.find((c) => c.id === "diagnostic_interviewing")?.score ??
          input.overall) *
          0.5) /
        1.5,
    ),
    risk: clamp(
      (process.risk_inquiry_present ? 70 : 25) +
        (competency_scores.find((c) => c.id === "risk_assessment")?.score ?? 50) * 0.3,
    ),
    mse: clamp(
      (process.mse_probe_present ? 65 : 30) +
        (competency_scores.find((c) => c.id === "mental_state_examination")?.score ??
          50) *
          0.35,
    ),
    alliance: clamp(
      40 +
        process.validation_count * 8 +
        process.reflection_count * 8 -
        process.advice_count * 5 -
        process.interruption_markers * 6,
    ),
    structure: clamp(
      40 +
        (process.closure_present ? 25 : 0) +
        Math.min(20, process.summarization_count * 10),
    ),
  };

  return {
    version: EDUCATION_FRAMEWORK_VERSION,
    education_version: EDUCATION_VERSION,
    session_id: input.sessionId,
    overall_from_assessment: input.overall,
    process,
    findings,
    coverage,
    missed_opportunities: missed,
    strengths,
    competency_scores,
  };
}

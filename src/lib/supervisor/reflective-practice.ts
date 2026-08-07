/**
 * Reflective Practice Engine — questions, hypotheses, bias, CT reminders.
 * Educational only. Never invents patient diagnoses.
 */

import type {
  ExpertReviewReport,
  ReflectivePracticePack,
  SupervisorRunInput,
} from "@/lib/supervisor/types";
import { SUPERVISOR_FRAMEWORK_VERSION } from "@/lib/supervisor/types";

export function buildReflectivePractice(input: {
  review: ExpertReviewReport;
  snapshot?: SupervisorRunInput["clinicalSnapshot"];
}): ReflectivePracticePack {
  const weak = [...input.review.skill_scores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  const reflection_questions = [
    "What did the patient prioritize that you may have underweighted?",
    "Where did you move to advice before full understanding?",
    ...weak.map(
      (s) =>
        `How would you strengthen ${s.id.replace(/_/g, " ")} given: "${s.evidence[0]?.excerpt?.slice(0, 100) ?? "limited evidence"}"?`,
    ),
    "If you repeated the first 5 minutes, what would you ask differently?",
  ];

  const teaching = input.snapshot?.clinical_teaching;
  const alternative_hypotheses = [
    ...(teaching?.differentials ?? []).slice(0, 3).map(
      (d) => `Alternative teaching differential to explore: ${d}`,
    ),
    ...(teaching?.rule_outs ?? []).slice(0, 2).map(
      (d) => `Rule-out still educationally relevant: ${d}`,
    ),
  ];
  if (alternative_hypotheses.length === 0) {
    alternative_hypotheses.push(
      "No case teaching differentials available — do not invent alternatives.",
    );
  }

  const bias_detection: string[] = [];
  const advice =
    input.review.skill_scores.find((s) => s.id === "active_listening")?.notes ??
    [];
  if (advice.some((n) => /advice/i.test(n))) {
    bias_detection.push("Possible rescue / advice-giving bias before exploration.");
  }
  if (
    (input.review.skill_scores.find((s) => s.id === "risk_assessment")?.score ??
      100) < 50
  ) {
    bias_detection.push(
      "Possible optimism bias or avoidance around risk inquiry.",
    );
  }
  const closed = input.review.skill_scores.find((s) => s.id === "closed_questions");
  if (closed && closed.score < 50) {
    bias_detection.push("Possible confirmation bias via leading/closed questions.");
  }
  if (bias_detection.length === 0) {
    bias_detection.push(
      "No strong bias markers from available process evidence; remain curious.",
    );
  }

  const countertransference_reminders = [
    "Notice urges to reassure prematurely when sitting with distress.",
    "If you felt stuck or irritated, name that privately before the next session.",
    "Attraction to 'fixing' the patient may signal over-identification — slow down.",
  ];

  const clinical_uncertainty_notes = [
    ...(input.review.session_review.educational_notes.slice(0, 2)),
    "Diagnostic labels belong to the case teaching key — not trainee invention.",
    input.review.domain_reports.find((d) => d.domain === "dsm")?.findings[0] ??
      "Hold uncertainty explicitly when evidence is incomplete.",
  ];

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    reflection_questions: reflection_questions.slice(0, 8),
    alternative_hypotheses: alternative_hypotheses.slice(0, 6),
    bias_detection: bias_detection.slice(0, 5),
    countertransference_reminders,
    clinical_uncertainty_notes: clinical_uncertainty_notes.filter(Boolean).slice(0, 6),
  };
}

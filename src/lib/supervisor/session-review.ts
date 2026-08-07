/**
 * Session Review Engine — strengths, gaps, alternatives, grounded references.
 */

import type { DiagnosticReasoningReport, SessionEvaluationReport } from "@/lib/education/types";
import type {
  EvidenceCitation,
  ModalityDetection,
  SessionReviewReport,
  TherapistSkillScore,
  SupervisorRunInput,
} from "@/lib/supervisor/types";
import { SUPERVISOR_FRAMEWORK_VERSION } from "@/lib/supervisor/types";

export function buildSessionReview(input: {
  sessionId: string;
  skillScores: TherapistSkillScore[];
  modalities: ModalityDetection[];
  evaluation?: SessionEvaluationReport | null;
  diagnostic?: DiagnosticReasoningReport | null;
  snapshot?: SupervisorRunInput["clinicalSnapshot"];
  educationFeedback?: {
    strengths?: string[];
    missed_opportunities?: string[];
    alternative_approaches?: string[];
    evidence_based_references?: string[];
  } | null;
}): SessionReviewReport {
  const strengths = [
    ...(input.evaluation?.strengths ?? []),
    ...(input.educationFeedback?.strengths ?? []),
    ...input.skillScores
      .filter((s) => s.score >= 75)
      .slice(0, 4)
      .map((s) => `${s.id.replace(/_/g, " ")} evidenced at ${s.score}/100`),
  ];

  const missed = [
    ...(input.evaluation?.missed_opportunities ?? []),
    ...(input.educationFeedback?.missed_opportunities ?? []),
    ...input.skillScores
      .filter((s) => s.score < 50)
      .slice(0, 4)
      .map((s) => s.notes[0] ?? `${s.id.replace(/_/g, " ")} underdeveloped`),
  ];

  const alternatives = [
    ...(input.educationFeedback?.alternative_approaches ?? []),
  ];
  const topModality = input.modalities.find((m) => m.modality !== "unknown");
  if (topModality) {
    alternatives.push(
      `Continue ${topModality.modality.replace(/_/g, " ")} moves already evidenced; deepen rather than switching modalities.`,
    );
  } else {
    alternatives.push(
      "Try one accurate reflection before advice when alliance is thin.",
      "If risk cues appear, pause agenda and complete a structured safety inquiry.",
    );
  }

  const evidence: EvidenceCitation[] = input.skillScores
    .flatMap((s) => s.evidence)
    .slice(0, 12);

  const dsm_references: string[] = [];
  const icd_references: string[] = [];
  const primary = input.snapshot?.primary_diagnosis;
  if (primary?.dsm5_code) {
    dsm_references.push(
      `Educational DSM-5 code on case key: ${primary.dsm5_code} (${primary.name})`,
    );
  }
  if (primary?.icd11_code) {
    icd_references.push(
      `Educational ICD-11 code on case key: ${primary.icd11_code} (${primary.name})`,
    );
  }
  for (const d of input.diagnostic?.supported_diagnoses ?? []) {
    dsm_references.push(`Teaching-supported differential label: ${d.name} (confidence ${d.confidence})`);
  }

  const clinical_references = [
    ...(input.educationFeedback?.evidence_based_references ?? []),
    "APA Practice Guideline summaries (educational)",
    "WHO ICD-11 clinical descriptions (educational)",
  ];

  const educational_notes = [
    ...(input.snapshot?.clinical_teaching?.teaching_points ?? []).slice(0, 4),
    ...(input.snapshot?.clinical_teaching?.common_mistakes ?? [])
      .slice(0, 2)
      .map((m) => `Common mistake to avoid: ${m}`),
    "Competency scores are educational aggregates — not validated clinical instruments.",
  ];

  const supervisor_comments = [
    `Reviewed ${input.skillScores.length} therapist skills against transcript and assessment evidence.`,
    missed[0]
      ? `Priority gap: ${missed[0]}`
      : "No major process gaps flagged from available evidence.",
    strengths[0]
      ? `Anchor strength: ${strengths[0]}`
      : "Continue building observable alliance skills.",
  ];

  return {
    version: SUPERVISOR_FRAMEWORK_VERSION,
    session_id: input.sessionId,
    strengths: [...new Set(strengths)].slice(0, 8),
    missed_opportunities: [...new Set(missed)].slice(0, 8),
    alternative_interventions: [...new Set(alternatives)].slice(0, 6),
    supervisor_comments,
    evidence,
    clinical_references: [...new Set(clinical_references)].slice(0, 6),
    dsm_references: [...new Set(dsm_references)].slice(0, 6),
    icd_references: [...new Set(icd_references)].slice(0, 4),
    educational_notes: educational_notes.filter(Boolean).slice(0, 8),
  };
}

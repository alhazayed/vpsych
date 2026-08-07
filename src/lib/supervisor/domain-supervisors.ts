/**
 * Domain supervisors — clinical, communication, psychotherapy, risk, DSM.
 * Educational observation only.
 */

import type {
  DomainSupervisorReport,
  EvidenceCitation,
  ModalityDetection,
  TherapistSkillScore,
} from "@/lib/supervisor/types";
import type { DiagnosticReasoningReport } from "@/lib/education/types";

function pickSkills(
  scores: TherapistSkillScore[],
  ids: string[],
): TherapistSkillScore[] {
  return scores.filter((s) => ids.includes(s.id));
}

function mean(scores: TherapistSkillScore[]): number {
  if (!scores.length) return 50;
  return Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length);
}

function severityFrom(score: number): DomainSupervisorReport["severity"] {
  if (score < 35) return "critical";
  if (score < 50) return "major";
  if (score < 70) return "minor";
  return "info";
}

export function buildClinicalSupervisor(
  scores: TherapistSkillScore[],
  diagnostic: DiagnosticReasoningReport | null | undefined,
): DomainSupervisorReport {
  const subset = pickSkills(scores, [
    "diagnostic_reasoning",
    "case_formulation",
    "clinical_prioritization",
    "treatment_planning",
  ]);
  const avg = mean(subset);
  const evidence: EvidenceCitation[] = subset.flatMap((s) => s.evidence.slice(0, 1));
  const findings: string[] = [];
  if (diagnostic?.missing_evidence?.length) {
    findings.push(
      ...diagnostic.missing_evidence
        .slice(0, 3)
        .map((m) => `Missing evidence (case teaching): ${m}`),
    );
  }
  if (avg < 60) {
    findings.push("Clinical reasoning skills below competent threshold on observed evidence.");
  }
  return {
    domain: "clinical",
    summary: `Clinical supervision composite ${avg}/100.`,
    findings,
    recommendations: subset
      .filter((s) => s.score < 65)
      .slice(0, 3)
      .map((s) => `Strengthen ${s.id.replace(/_/g, " ")} with cited practice.`),
    evidence,
    severity: severityFrom(avg),
  };
}

export function buildCommunicationSupervisor(
  scores: TherapistSkillScore[],
): DomainSupervisorReport {
  const subset = pickSkills(scores, [
    "rapport",
    "alliance",
    "empathy",
    "active_listening",
    "reflection",
    "validation",
    "open_questions",
    "closed_questions",
    "summarization",
    "professional_language",
  ]);
  const avg = mean(subset);
  return {
    domain: "communication",
    summary: `Communication supervision composite ${avg}/100.`,
    findings: subset
      .filter((s) => s.score < 55)
      .map(
        (s) =>
          `${s.id.replace(/_/g, " ")}: ${s.notes[0] ?? "Needs development"}`,
      ),
    recommendations: [
      "Validate before change strategies.",
      "Prefer open questions early; use closed questions for risk and facts.",
    ],
    evidence: subset.flatMap((s) => s.evidence.slice(0, 1)).slice(0, 5),
    severity: severityFrom(avg),
  };
}

export function buildPsychotherapySupervisor(
  scores: TherapistSkillScore[],
  modalities: ModalityDetection[],
): DomainSupervisorReport {
  const subset = pickSkills(scores, [
    "empathy",
    "validation",
    "treatment_planning",
    "alliance",
  ]);
  const avg = mean(subset);
  const top = modalities.filter((m) => m.modality !== "unknown").slice(0, 3);
  const findings = top.map(
    (m) =>
      `Observed ${m.modality.replace(/_/g, " ")} markers (confidence ${(m.confidence * 100).toFixed(0)}%) — not forced.`,
  );
  if (top.length === 0) {
    findings.push("No specific modality markers detected; supportive interviewing may have occurred.");
  }
  return {
    domain: "psychotherapy",
    summary: `Psychotherapy process composite ${avg}/100.`,
    findings,
    recommendations: [
      "Name the modality you intended only when markers support it.",
      "Do not force modality labels without transcript evidence.",
    ],
    evidence: top.flatMap((m) => m.evidence).slice(0, 4),
    severity: severityFrom(avg),
  };
}

export function buildRiskSupervisor(
  scores: TherapistSkillScore[],
): DomainSupervisorReport {
  const subset = pickSkills(scores, ["risk_assessment", "clinical_prioritization"]);
  const avg = mean(subset);
  const risk = subset.find((s) => s.id === "risk_assessment");
  const findings: string[] = [];
  if ((risk?.score ?? 0) < 50) {
    findings.push("Risk assessment incomplete on observed therapist turns.");
  }
  for (const n of risk?.notes ?? []) findings.push(n);
  return {
    domain: "risk",
    summary: `Risk supervision composite ${avg}/100.`,
    findings,
    recommendations: [
      "Ask directly about suicidal ideation, intent, plan, and protective factors.",
      "Prioritize safety before advice or homework.",
    ],
    evidence: subset.flatMap((s) => s.evidence),
    severity: severityFrom(avg),
  };
}

export function buildDsmSupervisor(
  scores: TherapistSkillScore[],
  diagnostic: DiagnosticReasoningReport | null | undefined,
  snapshot?: {
    primary_diagnosis?: {
      slug: string;
      name: string;
      dsm5_code?: string | null;
      icd11_code?: string | null;
    } | null;
  } | null,
): DomainSupervisorReport {
  const subset = pickSkills(scores, ["diagnostic_reasoning", "case_formulation"]);
  const avg = mean(subset);
  const findings: string[] = [];
  const primary = snapshot?.primary_diagnosis;
  if (primary) {
    findings.push(
      `Case teaching primary: ${primary.name}${primary.dsm5_code ? ` (DSM ${primary.dsm5_code})` : ""}${primary.icd11_code ? ` / ICD ${primary.icd11_code}` : ""} — educational key only.`,
    );
  }
  if (diagnostic?.case_primary_slug) {
    findings.push(`Educational case key slug: ${diagnostic.case_primary_slug}.`);
  }
  findings.push("Supervisor never invents a diagnosis; uses case teaching evidence only.");
  if (diagnostic?.missing_evidence?.length) {
    findings.push(`Evidence gaps for teaching key: ${diagnostic.missing_evidence.slice(0, 2).join("; ")}`);
  }
  return {
    domain: "dsm",
    summary: `DSM/ICD educational supervision composite ${avg}/100.`,
    findings,
    recommendations: [
      "Map transcript evidence to case teaching criteria — do not invent diagnoses.",
      "Separate DSM-5 and ICD-11 reasoning when both codes exist on the case.",
    ],
    evidence: subset.flatMap((s) => s.evidence.slice(0, 1)),
    severity: severityFrom(avg),
  };
}

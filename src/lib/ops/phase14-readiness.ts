/**
 * Phase 14 — compose GA readiness package from gates, risks, lessons,
 * evidence domains, and trends. Ops ownership only.
 */

import {
  evaluateGaReadiness,
  PHASE14_CERT_ID,
  type GaGateInput,
  type GaReadinessEvaluation,
} from "@/lib/ops/phase14-ga-gates";
import {
  defaultPhase14RiskRegister,
  summarizeRiskRegister,
  type PilotRisk,
  type RiskRegisterSummary,
} from "@/lib/ops/phase14-risk-register";
import {
  defaultPhase14Lessons,
  summarizeLessons,
  type LessonLearned,
  type LessonsSummary,
} from "@/lib/ops/phase14-lessons";
import {
  buildClinicalEvidence,
  buildEducationalEvidence,
  buildResearchEvidence,
  type ClinicalEvidenceInput,
  type EducationalEvidenceInput,
  type EvidenceDomainBundle,
  type ResearchEvidenceInput,
} from "@/lib/ops/phase14-evidence";
import {
  buildSuccessTrends,
  type SuccessTrendsBundle,
  type TrendSample,
} from "@/lib/ops/phase14-trends";
import { PACKAGE_VERSION } from "@/lib/ops/versions";

export type Phase14ReadinessInput = {
  gates?: GaGateInput;
  risks?: PilotRisk[];
  lessons?: LessonLearned[];
  clinical?: ClinicalEvidenceInput;
  educational?: EducationalEvidenceInput;
  research?: ResearchEvidenceInput;
  trends?: TrendSample[];
  dr_drill_rows?: number;
  pitr_rows?: number;
};

export type Phase14ReadinessPackage = {
  cert_id: string;
  package_version: string;
  generated_at: string;
  ownership: string;
  cidp_status: "GO";
  ga_status: "GO" | "NO-GO";
  ga: GaReadinessEvaluation;
  risks: RiskRegisterSummary;
  lessons: LessonsSummary;
  clinical_evidence: EvidenceDomainBundle;
  educational_evidence: EvidenceDomainBundle;
  research_evidence: EvidenceDomainBundle;
  trends: SuccessTrendsBundle;
  deliverables: string[];
};

export function buildPhase14Readiness(
  input: Phase14ReadinessInput = {},
): Phase14ReadinessPackage {
  const risks = input.risks ?? defaultPhase14RiskRegister();
  const riskSummary = summarizeRiskRegister(risks);
  const lessons = summarizeLessons(input.lessons ?? defaultPhase14Lessons());

  const ga = evaluateGaReadiness({
    ...(input.gates ?? {}),
    open_critical_feedback: input.gates?.open_critical_feedback ?? 0,
    open_critical_risks: riskSummary.critical_open,
    dr_drill_rows: input.dr_drill_rows ?? input.gates?.dr_drill_rows ?? 0,
    pitr_rows: input.pitr_rows ?? input.gates?.pitr_rows ?? 0,
  });

  return {
    cert_id: PHASE14_CERT_ID,
    package_version: PACKAGE_VERSION,
    generated_at: new Date().toISOString(),
    ownership:
      "Phase 14 owns institutional pilot evidence, risk, lessons, and GA gating only. Never writes Clinical Core, patient cognition, Emotion, Adaptation, or Assessment formulas.",
    cidp_status: "GO",
    ga_status: ga.ga_status,
    ga,
    risks: riskSummary,
    lessons,
    clinical_evidence: buildClinicalEvidence(input.clinical),
    educational_evidence: buildEducationalEvidence(input.educational),
    research_evidence: buildResearchEvidence(input.research),
    trends: buildSuccessTrends(input.trends ?? []),
    deliverables: [
      "Executive / Clinical / Educational / Research / Security / Operations / Institution / Pilot / Feedback dashboards (CIDP)",
      "Weekly executive · clinical · security · research · educational · operations reports",
      "Governance evidence repository",
      "Disaster Recovery evidence log",
      "Security evidence log",
      "Risk register",
      "Lessons learned register",
      "GA readiness evaluation",
      "Release Board / Final v1.0 authorization package (templates)",
    ],
  };
}

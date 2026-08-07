/**
 * Phase 15 — Final GA readiness package composer.
 */

import {
  evaluatePhase15Authorization,
  PHASE15_CERT_ID,
  type Phase15AuthorizationDecision,
  type Phase15AuthorizationInput,
} from "@/lib/ops/phase15-ga-authorization";
import {
  buildPilotCompletionReport,
  type PilotCompletionReport,
  type PilotInstitutionExtended,
} from "@/lib/ops/phase15-pilot-completion";
import {
  buildPhase15Certifications,
  type Phase15CertificationBundle,
} from "@/lib/ops/phase15-certification";
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
import { buildSuccessTrends, type TrendSample } from "@/lib/ops/phase14-trends";
import { PACKAGE_VERSION } from "@/lib/ops/versions";

export type Phase15ReadinessInput = {
  authorization?: Phase15AuthorizationInput;
  pilots?: PilotInstitutionExtended[];
  risks?: PilotRisk[];
  lessons?: LessonLearned[];
  trends?: TrendSample[];
  open_critical_feedback?: number;
};

export type Phase15ReadinessPackage = {
  cert_id: string;
  package_version: string;
  generated_at: string;
  ownership: string;
  cidp_status: "GO";
  ga_status: "GO" | "NO-GO";
  authorized_version: "1.0.0" | null;
  authorization: Phase15AuthorizationDecision;
  pilot_completion: PilotCompletionReport;
  certifications: Phase15CertificationBundle;
  risks: RiskRegisterSummary;
  lessons: LessonsSummary;
  trends: ReturnType<typeof buildSuccessTrends>;
  deliverables: string[];
  residual_risks: string[];
  board_recommendation: string;
};

export function buildPhase15Readiness(
  input: Phase15ReadinessInput = {},
): Phase15ReadinessPackage {
  const risks = input.risks ?? defaultPhase14RiskRegister();
  const riskSummary = summarizeRiskRegister(risks);
  const lessons = summarizeLessons(input.lessons ?? defaultPhase14Lessons());
  const pilot_completion = buildPilotCompletionReport(input.pilots ?? []);
  const certifications = buildPhase15Certifications();

  const authorization = evaluatePhase15Authorization({
    ...(input.authorization ?? {}),
    phase14_gates: {
      ...(input.authorization?.phase14_gates ?? {}),
      open_critical_feedback: input.open_critical_feedback ?? 0,
      open_critical_risks: riskSummary.critical_open,
    },
    pilot_objectives_met:
      input.authorization?.pilot_objectives_met ??
      pilot_completion.objectives_met,
    research_package_complete:
      input.authorization?.research_package_complete ??
      certifications.research.overall === "PASS",
    educational_validation_successful:
      input.authorization?.educational_validation_successful ??
      certifications.educational.overall === "PASS",
    clinical_validation_successful:
      input.authorization?.clinical_validation_successful ??
      certifications.clinical.overall === "PASS",
  });

  const residual_risks = riskSummary.unresolved.map(
    (r) => `${r.id}: ${r.description}`,
  );

  return {
    cert_id: PHASE15_CERT_ID,
    package_version: PACKAGE_VERSION,
    generated_at: new Date().toISOString(),
    ownership:
      "Phase 15 owns final GA authorization evaluation and Board evidence packaging only. Never writes Clinical Core, patient cognition, Emotion, Adaptation, Assessment formulas, Supervisor decision logic, or Enterprise tenancy rules.",
    cidp_status: "GO",
    ga_status: authorization.ga_status,
    authorized_version: authorization.authorized_version,
    authorization,
    pilot_completion,
    certifications,
    risks: riskSummary,
    lessons,
    trends: buildSuccessTrends(input.trends ?? []),
    deliverables: [
      "Final General Availability Readiness Report",
      "Executive Board Package",
      "Clinical Validation Report",
      "Educational Validation Report",
      "Research Validation Report",
      "Security Certification Report",
      "Disaster Recovery Certification",
      "Infrastructure Certification",
      "Pilot Completion Report",
      "Risk Closure Report",
      "Lessons Learned Report",
      "Version 1.0 GA Authorization (conditional)",
      "Final Release Notes",
      "Version 1.0 Changelog section (deferred until GA)",
    ],
    residual_risks,
    board_recommendation: authorization.decision,
  };
}

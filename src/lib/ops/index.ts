export { buildProductionOpsSnapshot } from "./metrics";
export type { ProductionOpsSnapshot } from "./metrics";
export { PACKAGE_VERSION, STAGE12_CERT_ID } from "./versions";
export { buildCidpDashboards, CIDP_CERT_ID } from "./cidp-dashboards";
export type {
  CidpDashboardBundle,
  CidpDashboardInput,
  CidpDashboardPanel,
  CidpMetric,
} from "./cidp-dashboards";
export {
  summarizePilotPortfolio,
  emptyPilotPortfolio,
  PILOT_STATUSES,
} from "./cidp-pilot";
export type { PilotInstitution, PilotPortfolioSummary, PilotStatus } from "./cidp-pilot";
export { buildCidpSuccessMetrics } from "./cidp-success-metrics";
export type {
  CidpSuccessMetricsBundle,
  CidpSuccessMetricsInput,
  CidpSuccessMetric,
} from "./cidp-success-metrics";
export { buildWeeklyReports } from "./cidp-weekly-reports";
export type { WeeklyReport, WeeklyReportInput, WeeklyReportKind } from "./cidp-weekly-reports";

export {
  evaluateGaReadiness,
  PHASE14_CERT_ID,
  GA_GATE_IDS,
} from "./phase14-ga-gates";
export type {
  GaGate,
  GaGateId,
  GaGateInput,
  GaGateStatus,
  GaReadinessEvaluation,
} from "./phase14-ga-gates";

export {
  defaultPhase14RiskRegister,
  summarizeRiskRegister,
  isCriticalRisk,
  riskScore,
  RISK_LIKELIHOODS,
  RISK_IMPACTS,
  RISK_STATUSES,
} from "./phase14-risk-register";
export type {
  PilotRisk,
  RiskImpact,
  RiskLikelihood,
  RiskRegisterSummary,
  RiskStatus,
} from "./phase14-risk-register";

export {
  defaultPhase14Lessons,
  summarizeLessons,
  LESSON_CATEGORIES,
} from "./phase14-lessons";
export type {
  LessonCategory,
  LessonLearned,
  LessonsSummary,
} from "./phase14-lessons";

export {
  buildClinicalEvidence,
  buildEducationalEvidence,
  buildResearchEvidence,
} from "./phase14-evidence";
export type {
  ClinicalEvidenceInput,
  EducationalEvidenceInput,
  EvidenceDomainBundle,
  EvidenceMetric,
  ResearchEvidenceInput,
} from "./phase14-evidence";

export { buildSuccessTrends } from "./phase14-trends";
export type {
  SuccessTrendSeries,
  SuccessTrendsBundle,
  TrendPoint,
  TrendSample,
} from "./phase14-trends";

export { buildPhase14Readiness } from "./phase14-readiness";
export type {
  Phase14ReadinessInput,
  Phase14ReadinessPackage,
} from "./phase14-readiness";

export {
  evaluatePhase15Authorization,
  PHASE15_CERT_ID,
  PHASE15_BOARD_GATES,
} from "./phase15-ga-authorization";
export type {
  Phase15AuthorizationDecision,
  Phase15AuthorizationInput,
  Phase15BoardGate,
  Phase15BoardGateId,
  Phase15GateStatus,
} from "./phase15-ga-authorization";

export { buildPilotCompletionReport } from "./phase15-pilot-completion";
export type {
  PilotCompletionReport,
  PilotInstitutionExtended,
} from "./phase15-pilot-completion";

export {
  buildPhase15Certifications,
  buildSecurityCertification,
  buildDisasterRecoveryCertification,
  buildInfrastructureCertification,
  buildClinicalCertification,
  buildEducationalCertification,
  buildResearchCertification,
  buildOperationalCertification,
} from "./phase15-certification";
export type {
  CertificationCheck,
  CertificationStatus,
  Phase15CertificationBundle,
  WorkstreamCertification,
} from "./phase15-certification";

export { buildPhase15Readiness } from "./phase15-readiness";
export type {
  Phase15ReadinessInput,
  Phase15ReadinessPackage,
} from "./phase15-readiness";

export {
  EVIDENCE_PENDING,
  observed,
  pending,
  observedNumberOrPending,
  displayEvidence,
} from "./phase16-evidence-state";
export type { EvidenceState, EvidenceValue } from "./phase16-evidence-state";

export {
  buildInstitutionPilotDashboard,
  INSTITUTION_TYPES,
} from "./phase16-institutions";
export type {
  InstitutionPilotDashboard,
  InstitutionPilotProfile,
  InstitutionType,
} from "./phase16-institutions";

export {
  buildPhase16Dashboards,
  buildClinicalEvidenceDashboard,
  buildEducationEvidenceDashboard,
  buildResearchEvidenceDashboard,
  buildSecurityEvidenceDashboard,
  buildOperationsEvidenceDashboard,
  buildExecutiveEvidenceDashboard,
} from "./phase16-dashboards";
export type {
  DomainDashboard,
  Phase16DashboardBundle,
  Phase16DashboardInput,
} from "./phase16-dashboards";

export {
  evaluatePhase16GaGates,
  PHASE16_CERT_ID,
  PHASE16_GA_GATES,
} from "./phase16-ga-gates";
export type {
  Phase16GaEvaluation,
  Phase16GaGate,
  Phase16GaGateId,
  Phase16GaGateInput,
} from "./phase16-ga-gates";

export { buildPhase16ExecutiveReport } from "./phase16-reports";
export type {
  Phase16ExecutiveReport,
  Phase16ReportInput,
  Phase16ReportKind,
} from "./phase16-reports";

export { buildPhase16Execution } from "./phase16-execution";
export type {
  Phase16ExecutionInput,
  Phase16ExecutionPackage,
} from "./phase16-execution";

export { PHASE15_PROGRAM_ID, PHASE16_PROGRAM_ID } from "./versions";

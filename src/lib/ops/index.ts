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

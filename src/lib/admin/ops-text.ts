/**
 * Display translation for English text that admin ops / enterprise /
 * supervisor APIs generate in code (dashboard metric labels, GA gate labels,
 * policy statements, risk register entries).
 *
 * The API payloads stay English (they are also exported and asserted by lib
 * tests); the admin pages translate at render time. Each entry maps a message
 * key under `admin.opsText` to the exact English the server sends. Text that is
 * not listed here (or that has changed in code since) is shown unchanged, so
 * a new or edited server string is never shown with a stale translation.
 */
export const OPS_TEXT = {
  cidpPhiPolicy: "No patient-identifiable information. Counts and formative aggregates only.",
  p16Ownership: "Phase 16 owns institutional pilot execution evidence, monitoring reports, and GA gate display only. Never writes Clinical Core, patient cognition, Supervisor AI, scientific validation, or Enterprise architecture.",
  p16Fabrication: "Do not fabricate pilot data, clinical outcomes, DR/PITR drills, pen-tests, feedback, or research evidence. Missing ⇒ Evidence Pending.",
  p16DecisionGo: "GO FOR GENERAL AVAILABILITY",
  p16DecisionNoGo: "Remain Controlled Institutional Deployment (1.0.0-rc.1). Never recommend GA without verified operational evidence.",
  p16Disclaimer: "Phase 16 execution evidence. Missing drills/surveys/pilots = Evidence Pending. Clinical Core frozen. GA NO-GO until all gates PASS.",
  p16NoteInstitutions: "institutions table row count is observed for executive metrics; pilot registry profiles remain Evidence Pending until formally recorded.",
  p14Ownership: "Phase 14 owns institutional pilot evidence, risk, lessons, and GA gating only. Never writes Clinical Core, patient cognition, Emotion, Adaptation, or Assessment formulas.",
  p14RecommendationGo: "All GA gates PASS — Release Board may authorize v1.0.0 via RDL.",
  p14RecommendationNoGo: "Remain on Controlled Institutional Deployment (1.0.0-rc.1). GO for CIDP. NO-GO for GA.",
  p14Disclaimer: "Phase 14 operational evidence package. Competency scores are not validated. GA remains NO-GO until all gates PASS and Release Board authorizes v1.0.0.",
  p15Ownership: "Phase 15 owns final GA authorization evaluation and Board evidence packaging only. Never writes Clinical Core, patient cognition, Emotion, Adaptation, Assessment formulas, Supervisor decision logic, or Enterprise tenancy rules.",
  p15DecisionGo: "AUTHORIZE Vtraining Version 1.0.0 General Availability.",
  p15DecisionNoGo: "NO-GO for General Availability. Remain on Controlled Institutional Deployment (1.0.0-rc.1).",
  p15MotionGo: "Motion: Tag v1.0.0, bump package.json to 1.0.0, publish Final Release Notes, append authorizing RDL.",
  p15MotionNoGo: "Motion: Refuse GA; continue CIDP pilots; close open Phase 15 gates with signed evidence; re-convene Board.",
  p15Disclaimer: "Phase 15 final GA authorization package. Empty DR/PITR/pilot evidence keeps GA at NO-GO. Clinical Core unchanged. Competency scores are not validated.",
  evidencePending: "Evidence Pending",
  evidenceFeedbackRisk: "institutional_feedback + risk register",
  evidenceMetricsPortfolio: "CIDP success metrics + pilot portfolio",
  detailResidualsClosed: "Residuals closed",
  detailObjectivesMet: "Objectives met from observed pilots",
  detailZeroCritical: "Zero open critical feedback/risks (observed)",
  detailClinicalClosed: "Board-closed clinical validation",
  detailEducationalClosed: "Board-closed educational validation",
  detailResearchClosed: "Board-closed research validation",
  detailSignedRdl: "Signed GA RDL present",
  g14DrDrill: "Disaster Recovery drill completed",
  g14Pitr: "Point-in-Time Recovery validated",
  g14Infra: "Production infrastructure verified",
  gSecurityResiduals: "Security residuals closed",
  gNoCritical: "No unresolved Critical findings",
  g14StablePilot: "Stable pilot metrics",
  g14EduOutcomes: "Acceptable educational outcomes",
  g14Clinical: "Clinical validation completed",
  g14Governance: "Governance package approved",
  g14Board: "Executive Release Board authorization",
  g15Dr: "Disaster Recovery completed",
  g15Pitr: "PITR verified",
  g15Infra: "Infrastructure validated",
  g15Pilot: "Pilot objectives achieved",
  g15Clinical: "Clinical validation successful",
  g15Educational: "Educational validation successful",
  g15Research: "Research package complete",
  g15Governance: "Governance approved",
  g15Board: "Executive Board approval received",
  g16DrDrill: "DR Drill Completed",
  g16Pitr: "PITR Verified",
  g16PenTest: "Penetration Test Completed",
  g16SecurityResiduals: "Security Residuals Closed",
  g16Pilot: "Pilot Objectives Achieved",
  g16CriticalZero: "Critical Issues = 0",
  g16Clinical: "Clinical Validation Complete",
  g16Educational: "Educational Validation Complete",
  g16Research: "Research Validation Complete",
  g16Board: "Release Board Approval Signed",
  panelSystem: "System",
  panelClinical: "Clinical simulation (counts only)",
  panelEducational: "Educational",
  panelInstitution: "Institution",
  panelResearch: "Research",
  panelSecurity: "Security",
  panelFeedback: "Feedback",
  panelPilot: "Pilot status",
  uptime: "Uptime",
  apiP50: "API latency p50",
  apiP95: "API latency p95",
  sseP95: "SSE p95",
  voiceP95: "Voice E2E p95",
  queueDepth: "Queue depth",
  errorRate: "Error rate",
  simStarted: "Simulations started",
  simCompletedA: "Completed simulations",
  simAbandoned: "Abandoned simulations",
  assessmentCompletion: "Assessment completion",
  supervisorCompletion: "Supervisor completion",
  validationCompletion: "Validation completion",
  simCompletionRate: "Simulation completion rate",
  curriculumCompletion: "Curriculum completion",
  certificationProgress: "Certification progress",
  competencyGrowth: "Competency growth",
  residentEngagement: "Resident engagement",
  activeResidents: "Active residents",
  activeFaculty: "Active faculty",
  institutions: "Institutions",
  departments: "Departments",
  campuses: "Campuses",
  datasets: "Datasets",
  validationRuns: "Validation runs",
  interRaterAgreement: "Inter-rater agreement",
  meanRealism: "Mean realism score",
  publicationDatasets: "Publication datasets",
  authFailures: "Authentication failures",
  rbacViolations: "RBAC violations",
  rateLimitHits: "Rate-limit hits",
  auditEvents: "Audit events",
  securityAlerts: "Security alerts",
  feedbackTotal: "Total feedback",
  openCritical: "Open critical",
  openHigh: "Open high",
  resolved: "Resolved",
  pilotsActive: "Active pilots",
  pilotsPlanned: "Planned pilots",
  supportRequests: "Support requests",
  dau: "Daily active users",
  wau: "Weekly active users",
  avgDuration: "Average session duration",
  learningProgress: "Learning progress (mean formative)",
  certRate: "Certification rate",
  supervisorAgreement: "Supervisor agreement",
  systemUptime: "System uptime",
  noteFormative: "Formative",
  noteNotValidated: "Not a validated instrument",
  noteNotReliabilityCoefficient: "Observational — not a published reliability coefficient",
  noteFormativeIndex: "Formative observational index",
  noteNotValidatedClinical: "Not a validated clinical instrument",
  noteEducationalOnly: "Educational observation only",
  deploymentSuccessRate: "Deployment success rate",
  systemAvailability: "System availability",
  avgApiResponse: "Average API response (p95)",
  residentSatisfaction: "Resident satisfaction",
  facultySatisfaction: "Faculty satisfaction",
  assessmentConsistency: "Assessment consistency",
  validationConsistency: "Validation consistency",
  operationalStability: "Operational stability (1 − error rate)",
  researchUtilization: "Research utilization (exports)",
  dashExecutive: "Executive Dashboard",
  dashClinical: "Clinical Evidence",
  dashEducational: "Educational Evidence",
  dashResearch: "Research Evidence",
  dashSecurity: "Security Evidence",
  dashOperations: "Operations Evidence",
  clinicalRealism: "Clinical realism",
  dsmConsistency: "DSM consistency",
  icdConsistency: "ICD consistency",
  interRaterReliability: "Inter-rater reliability",
  educationalProgression: "Educational progression",
  competencyImprovement: "Competency improvement",
  simCompletedLifecycle: "Simulations completed (lifecycle)",
  facultyEngagement: "Faculty engagement",
  learningCompletion: "Learning completion",
  certificationCompletion: "Certification completion",
  sessionFrequency: "Session frequency (completed)",
  learningSatisfaction: "Learning satisfaction",
  knowledgeRetention: "Knowledge retention",
  skillProgression: "Skill progression",
  participatingInstitutions: "Participating institutions",
  clinicalRealismStats: "Clinical realism statistics",
  simUtilization: "Simulation utilization (completed)",
  educationalOutcomesIndex: "Educational outcomes index",
  dependencyVulns: "Dependency high+ vulnerabilities",
  auditLogEvents: "Audit log events",
  openCriticalFeedback: "Open critical feedback",
  penTestRows: "Penetration test evidence rows",
  secretRotationRows: "Secret rotation evidence rows",
  uptimeRatio: "Uptime ratio",
  activeSessions: "Active sessions",
  drDrillRows: "DR drill evidence rows",
  pitrRows: "PITR evidence rows",
  backupObserved: "Backup status observed",
  backupStatus: "Backup status",
  restoreObserved: "Restore readiness observed",
  restoreReadiness: "Restore readiness",
  simCompletedB: "Simulations completed",
  openCriticalIssues: "Open critical issues (feedback)",
  institutionsRegistered: "Institutions registered",
  facultyUsers: "Faculty users",
  residentUsers: "Resident users",
  activeLearners: "Active learners",
  assessmentsCompleted: "Assessments completed",
  supervisorReviews: "Supervisor reviews",
  certificationsIssued: "Certifications issued",
  dropoutRate: "Dropout / abandon rate",
  clinicalRealismRating: "Clinical realism rating (mean)",
  assessmentReliabilityProxy: "Assessment reliability proxy",
  facultyObservations: "Faculty observations logged",
  residentProgression: "Resident progression",
  competencyMilestones: "Competency milestones reached",
  knowledgeRetentionProxy: "Knowledge retention proxy",
  multicenterSites: "Multicenter participating sites",
  publicationReadyDatasets: "Publication-ready datasets",
  longitudinalTracks: "Longitudinal tracks",
  realismIndexObservational: "Realism index (observational)",
  noteObservationalNotValidated: "Observational — not a validated instrument",
  noteNotScientificallyValidated: "Not scientifically validated",
  institutionAdoption: "Institution adoption",
  residentRetention: "Resident retention",
  facultyAdoption: "Faculty adoption",
  sessionCompletion: "Session completion",
  assessmentReliability: "Assessment reliability",
  supervisorConsistency: "Supervisor consistency",
  platformAvailability: "Platform availability",
  supportVolume: "Support volume",
  criticalIncidentRate: "Critical incident rate",
  securityEvents: "Security events",
  researchParticipation: "Research participation",
  certificationSuccess: "Certification success",
  riskDrPitr: "Disaster Recovery / PITR live drill not yet evidenced — blocks GA.",
  riskScoresUnvalidated: "Competency / assessment scores not scientifically validated — marketing overclaim risk.",
  riskMonitoring: "Production APM / Sentry monitoring incomplete — delayed incident detection.",
  riskHibp: "Supabase Auth leaked-password protection residual (HIBP) may remain disabled.",
  riskMemberships: "Institution memberships sparse — pilot analytics may under-count faculty/residents.",
  riskFreezeBreach: "Feature freeze breach — accidental Clinical Core / cognition change during pilot.",
  ownerDevSecOps: "DevSecOps Lead",
  ownerClinicalGovernance: "Clinical Governance Lead",
  ownerEnterprisePm: "Enterprise Program Manager",
  ownerArchitect: "Chief Software Architect",
  ownerBoardChair: "Release Board Chair",
  lessonPackaging: "CIDP packaging precedes GA evidence",
  lessonSoftFail: "Soft-fail metrics avoid blocking reports",
  lessonFormative: "Never equate formative scores with validated instruments",
  enterpriseOwnership: "Enterprise owns tenancy, RBAC, org hierarchy, courses, org certificates, analytics dashboards, research study metadata, webhooks, observability, and institutional pilot feedback (CIDP). Never owns Patient, Memory, Emotion, Adaptation, Case Engine, Clinical Intelligence, Validation scoring, or Supervisor skill evaluation. Never changes patient state or cognition. Never exposes session_reports to therapists.",
  enterpriseDisclaimer: "Enterprise tenancy and formative analytics only. Never modifies patient cognition. Competency scores are not validated clinical instruments.",
  kpiSessions: "Sessions",
  kpiMeanOverall: "Mean formative overall",
  kpiCompletionRate: "Completion rate",
  kpiPrograms: "Programs",
  kpiFaculty: "Faculty",
  kpiCertificates: "Certificates issued",
  kpiResearchExports: "Research exports",
  hierOrganization: "Organization",
  hierCampus: "Campus",
  hierDepartment: "Department",
  hierTrainingProgram: "Training Program",
  hierCourse: "Course",
  hierInstructor: "Instructor",
  hierSupervisor: "Supervisor",
  hierResident: "Resident",
  hierStudent: "Student",
  hierTherapist: "Therapist",
  hierObserver: "Observer",
  hierResearcher: "Researcher",
  hierAdministrator: "Administrator",
  supervisorOwnership: "Supervisor observes only. Evaluates therapists — not patients. Never owns Patient, Memory, Emotion, Adaptation, Case Engine, Clinical Intelligence, or Validation. Never changes patient state or cognition.",
  supervisorDisclaimer: "Educational supervision only. Competency scores are not validated clinical instruments. Supervisor never modifies patient state.",
  limitAggregates: "Dashboard aggregates observational fidelity metrics only",
  limitUnvalidated: "Competency scores remain unvalidated",
  limitOfflineFallback: "Empty corpora fall back to offline simulations marked as such in longitudinal results",
  riskSummaryNone: "No open risks in register — verify evidence freshness before GA motion.",
} as const;

/**
 * Server sentences that carry a count. Each key's message under
 * `admin.opsText` takes `{count}`.
 */
const OPS_PATTERNS: ReadonlyArray<{ key: string; pattern: RegExp }> = [
  { key: "detailDrillRows", pattern: /^(\d+) signed drill row\(s\)$/ },
  { key: "detailPitrRows", pattern: /^(\d+) PITR row\(s\)$/ },
  { key: "detailPenTestRows", pattern: /^(\d+) pen-test evidence row\(s\)$/ },
  { key: "detailCriticalOpen", pattern: /^(\d+) critical item\(s\) open$/ },
  {
    key: "riskSummaryCritical",
    pattern: /^(\d+) critical-tier risk\(s\) unresolved — GA blocked\.$/,
  },
  {
    key: "riskSummaryOpen",
    pattern:
      /^(\d+) open\/mitigating risk\(s\); no critical-tier open — continue CIDP observation\.$/,
  },
];

export type OpsTextKey = keyof typeof OPS_TEXT;

const KEY_BY_TEXT: ReadonlyMap<string, OpsTextKey> = new Map(
  (Object.entries(OPS_TEXT) as Array<[OpsTextKey, string]>).map(
    ([key, text]) => [text, key],
  ),
);

/** The `admin.opsText` key for this exact server text, or null. */
export function opsTextKey(text: string | null | undefined): OpsTextKey | null {
  if (!text) return null;
  return KEY_BY_TEXT.get(text) ?? null;
}

type Translator = {
  has(key: string): boolean;
  (key: string, values?: Record<string, number>): string;
};

/**
 * Server text in the UI language: the `admin.opsText` translation when the
 * text is known, else the text unchanged. `t` is `useTranslations("admin.opsText")`.
 */
export function localizeOpsText(
  t: Translator,
  text: string | null | undefined,
): string {
  if (!text) return "";
  const key = opsTextKey(text);
  if (key && t.has(key)) return t(key);
  for (const { key: patternKey, pattern } of OPS_PATTERNS) {
    const match = pattern.exec(text);
    if (match && t.has(patternKey)) {
      return t(patternKey, { count: Number(match[1]) });
    }
  }
  return text;
}

/**
 * A status / enum code from a server payload in the UI language: the message
 * at `${group}.${code}` when it exists, else the code unchanged.
 */
export function codeLabel(
  t: Translator,
  group: string,
  code: string | null | undefined,
): string {
  if (!code) return "";
  const key = `${group}.${code}`;
  return t.has(key) ? t(key) : code;
}

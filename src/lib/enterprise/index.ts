/**
 * Stage 10 — Enterprise Platform.
 *
 * Multi-tenant infrastructure for universities, hospitals, clinics,
 * corporate, government, and private organizations.
 *
 * NEVER modifies patient behaviour, cognition, memory, emotion, adaptation,
 * case engine, clinical intelligence, validation ownership, or supervisor
 * skill evaluation ownership.
 */

export {
  ENTERPRISE_VERSION,
  ENTERPRISE_RBAC_VERSION,
  ENTERPRISE_COURSE_ENGINE_VERSION,
  ENTERPRISE_CERT_ENGINE_VERSION,
} from "@/lib/enterprise/types";
export type * from "@/lib/enterprise/types";

export {
  ENTERPRISE_FORBIDDEN_WRITES,
  ENTERPRISE_OWNERSHIP_RULE,
  buildEnterpriseVersionLock,
} from "@/lib/enterprise/versions";

export {
  mapLegacyMembershipRole,
  platformRoleToEnterprise,
  permissionsFor,
  hasPermission,
  assertPermission,
  isCrossTenantRole,
  listEnterpriseRoles,
  rbacMatrix,
} from "@/lib/enterprise/rbac";

export {
  TENANT_TYPES,
  isTenantType,
  assertTenantAccess,
  isolateByOrganization,
  verifyMutualIsolation,
  stampSessionTenant,
} from "@/lib/enterprise/tenant";

export {
  normalizeTenantType,
  organizationFromInstitutionRow,
  buildOrgHierarchy,
  hierarchySummary,
  HIERARCHY_LABELS,
} from "@/lib/enterprise/organization";

export {
  createCourse,
  publishCourse,
  createModule,
  createLesson,
  attachLesson,
  createRotation,
  createLearningPath,
  createGraduationRequirement,
  evaluateGraduation,
} from "@/lib/enterprise/course-engine";

export {
  CERTIFICATE_KINDS,
  issueCertificate,
  revokeCertificate,
  verifyCertificate,
  evaluateOscePass,
  boardPrepProgress,
} from "@/lib/enterprise/certification";

export {
  createLibrary,
  addLibraryEntry,
  submitForApproval,
  approveLibrary,
  rejectLibrary,
  publishEntry,
  canReadLibrary,
} from "@/lib/enterprise/case-libraries";

export {
  buildAnalyticsDashboard,
  ANALYTICS_SCOPES,
} from "@/lib/enterprise/analytics";
export type { AnalyticsInput } from "@/lib/enterprise/analytics";

export { buildLongitudinalTrack } from "@/lib/enterprise/longitudinal";

export {
  createResearchStudy,
  activateStudy,
  addParticipatingOrg,
  registerDatasetKey,
  buildExportManifest,
  canOrgAccessStudy,
} from "@/lib/enterprise/research";

export {
  buildObservabilitySnapshot,
  PERFORMANCE_ENVELOPE,
} from "@/lib/enterprise/observability";
export type { ObservabilitySample } from "@/lib/enterprise/observability";

export {
  defaultAuthPolicy,
  enableSso,
  sessionStillValid,
  recordAudit,
  authorizeTenantAction,
  secretRef,
  buildSecurityDashboard,
} from "@/lib/enterprise/security";
export type {
  SsoProviderKind,
  EnterpriseAuthPolicy,
  SecurityDashboard,
} from "@/lib/enterprise/security";

export {
  ENTERPRISE_REST_ROUTES,
  integrationCatalog,
  createWebhookEndpoint,
  signWebhookPayload,
} from "@/lib/enterprise/api-contracts";

export {
  storeEnterpriseBundle,
  listEnterpriseBundles,
  storeCertificate,
  listCertificates,
  listAllCertificates,
  pushAudit,
  listAudits,
  storeStudy,
  getStudy,
  storeWebhook,
  listWebhooks,
  clearEnterpriseStoreForTests,
} from "@/lib/enterprise/store";

export {
  runEnterpriseEngine,
  buildEnterpriseContext,
  buildEnterpriseAdminOverview,
} from "@/lib/enterprise/engine";
export type { EnterpriseRunInput } from "@/lib/enterprise/engine";

export { runEnterpriseAfterAssessment } from "@/lib/enterprise/session-bridge";
export type { EnterpriseBridgeResult } from "@/lib/enterprise/session-bridge";

export {
  FEEDBACK_ROLES,
  FEEDBACK_SEVERITIES,
  FEEDBACK_CLASSIFICATIONS,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_REPRODUCIBILITY,
  FEEDBACK_CATEGORIES,
  defaultPriorityForSeverity,
  normalizeFeedbackSeverity,
  classifyFeedbackSeverity,
  appendFeedbackAudit,
  validateFeedbackInput,
  validateFeedbackAdminPatch,
  summarizeFeedback,
} from "@/lib/enterprise/feedback";
export type {
  FeedbackRole,
  FeedbackSeverity,
  FeedbackClassification,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackReproducibility,
  FeedbackAuditEvent,
  InstitutionalFeedbackInput,
  InstitutionalFeedbackRecord,
} from "@/lib/enterprise/feedback";

/**
 * Stage 10 — Enterprise Platform domain types.
 *
 * Extends Mission 18 institutional schema. Does not redefine Patient ontology
 * or fork Stages 1–9 engines.
 */

export const ENTERPRISE_VERSION = "10.0.0";
export const ENTERPRISE_RBAC_VERSION = "1.0.0";
export const ENTERPRISE_COURSE_ENGINE_VERSION = "1.0.0";
export const ENTERPRISE_CERT_ENGINE_VERSION = "1.0.0";

/** Tenant / organization archetypes. */
export type TenantType =
  | "university"
  | "hospital"
  | "clinic"
  | "corporate"
  | "government"
  | "private_organization";

/**
 * Centralized enterprise RBAC roles.
 * Platform roles (system_owner, global_admin) map to profiles.role = admin.
 * Org-scoped roles map onto institution_memberships (+ Stage 10 extensions).
 */
export type EnterpriseRole =
  | "system_owner"
  | "global_admin"
  | "organization_admin"
  | "program_director"
  | "supervisor"
  | "faculty"
  | "resident"
  | "student"
  | "therapist"
  | "observer"
  | "research_coordinator"
  | "guest"
  | "support";

/** Legacy Mission 18 membership roles still present in Postgres. */
export type LegacyMembershipRole =
  | "student"
  | "resident"
  | "psychologist"
  | "gp"
  | "faculty"
  | "instructor"
  | "program_director"
  | "institution_admin"
  | "supervisor"
  | "observer"
  | "research_coordinator"
  | "guest"
  | "support"
  | "therapist";

export type Permission =
  | "tenant.read"
  | "tenant.manage"
  | "users.read"
  | "users.manage"
  | "programs.read"
  | "programs.manage"
  | "courses.read"
  | "courses.manage"
  | "courses.publish"
  | "assignments.read"
  | "assignments.manage"
  | "assignments.grade"
  | "sessions.read_own"
  | "sessions.read_tenant"
  | "sessions.observe"
  | "reports.read_own"
  | "reports.read_tenant"
  | "libraries.read"
  | "libraries.manage"
  | "libraries.publish"
  | "libraries.approve"
  | "analytics.read"
  | "analytics.executive"
  | "certificates.issue"
  | "certificates.verify"
  | "research.read"
  | "research.manage"
  | "research.export"
  | "security.audit"
  | "security.manage"
  | "webhooks.manage"
  | "integrations.manage"
  | "observability.read"
  | "support.impersonate_readonly";

export type EnterpriseVersionLock = {
  enterprise_version: string;
  rbac_version: string;
  course_engine_version: string;
  cert_engine_version: string;
  computed_at: string;
};

export type Organization = {
  id: string;
  slug: string;
  name: string;
  legal_name: string | null;
  tenant_type: TenantType;
  country_code: string;
  timezone: string;
  locale_default: string;
  sso_enabled: boolean;
  sso_provider: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
};

export type Campus = {
  id: string;
  organization_id: string;
  slug: string;
  name: string;
  city: string | null;
  country_code: string | null;
  is_active: boolean;
};

export type DepartmentNode = {
  id: string;
  organization_id: string;
  campus_id: string | null;
  slug: string;
  name: string;
  is_active: boolean;
};

export type ProgramNode = {
  id: string;
  organization_id: string;
  department_id: string | null;
  slug: string;
  name: string;
  degree_type: string | null;
  is_active: boolean;
};

export type TrainingProgramNode = ProgramNode & {
  kind: "training_program";
};

export type Membership = {
  id: string;
  organization_id: string;
  user_id: string;
  role: EnterpriseRole;
  department_id: string | null;
  program_id: string | null;
  campus_id: string | null;
  cohort_id: string | null;
  is_primary: boolean;
  is_active: boolean;
};

export type OrgHierarchy = {
  organization: Organization;
  campuses: Campus[];
  departments: DepartmentNode[];
  programs: ProgramNode[];
};

export type CourseStatus = "draft" | "published" | "archived" | "retired";

export type Course = {
  id: string;
  organization_id: string;
  program_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  language: string;
  competency_ids: string[];
  graduation_requirement_ids: string[];
  version: number;
  created_by: string | null;
};

export type CourseModule = {
  id: string;
  course_id: string;
  organization_id: string;
  slug: string;
  title: string;
  sort_order: number;
  lesson_ids: string[];
};

export type CourseLesson = {
  id: string;
  module_id: string;
  organization_id: string;
  slug: string;
  title: string;
  sort_order: number;
  lesson_type:
    | "didactic"
    | "simulation"
    | "osce"
    | "rotation"
    | "reflection"
    | "assessment";
  simulation_template_slug: string | null;
  estimated_minutes: number | null;
};

export type ClinicalRotation = {
  id: string;
  organization_id: string;
  program_id: string | null;
  course_id: string | null;
  title: string;
  site_label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  supervisor_user_ids: string[];
  competency_ids: string[];
};

export type LearningPath = {
  id: string;
  organization_id: string;
  slug: string;
  title: string;
  course_ids: string[];
  required_certificate_kinds: CertificateKind[];
};

export type GraduationRequirement = {
  id: string;
  organization_id: string;
  program_id: string | null;
  label: string;
  min_sessions: number;
  min_overall_score: number;
  required_competency_ids: string[];
  required_certificate_kinds: CertificateKind[];
};

export type LibraryVisibility = "private" | "organization" | "shared" | "platform";
export type LibraryKind =
  | "enterprise"
  | "university"
  | "dsm"
  | "icd"
  | "research"
  | "shared"
  | "private";

export type CaseLibrary = {
  id: string;
  organization_id: string | null;
  slug: string;
  title: string;
  kind: LibraryKind;
  visibility: LibraryVisibility;
  version: number;
  approval_status: "draft" | "pending" | "approved" | "rejected";
  entry_count: number;
};

export type CaseLibraryEntry = {
  id: string;
  library_id: string;
  organization_id: string | null;
  scenario_template_slug: string;
  title: string;
  version: number;
  published: boolean;
};

export type CertificateKind =
  | "competency"
  | "course"
  | "university"
  | "board_prep"
  | "residency_milestone"
  | "osce"
  | "cme"
  | "digital";

export type DigitalCertificate = {
  id: string;
  organization_id: string;
  user_id: string;
  kind: CertificateKind;
  title: string;
  issued_at: string;
  expires_at: string | null;
  verification_code: string;
  qr_payload: string;
  metadata: Record<string, unknown>;
  revoked: boolean;
};

export type CertificateVerification = {
  valid: boolean;
  certificate: DigitalCertificate | null;
  reason: string | null;
};

export type AnalyticsScope =
  | "organization"
  | "program"
  | "department"
  | "faculty"
  | "resident"
  | "student"
  | "supervisor"
  | "research"
  | "executive";

export type AnalyticsDashboard = {
  scope: AnalyticsScope;
  organization_id: string;
  generated_at: string;
  kpis: Array<{ id: string; label: string; value: number; unit?: string }>;
  series: Array<{ id: string; label: string; points: Array<{ t: string; v: number }> }>;
  notes: string[];
};

export type LongitudinalTrack = {
  user_id: string;
  organization_id: string;
  horizon: "months" | "years" | "residency" | "board_prep" | "faculty_dev" | "cme" | "lifetime";
  milestones: Array<{ id: string; label: string; at: string; status: "pending" | "met" | "missed" }>;
  session_count: number;
  overall_ema: number;
};

export type ResearchStudy = {
  id: string;
  slug: string;
  title: string;
  lead_organization_id: string;
  participating_organization_ids: string[];
  irb_tag: string | null;
  status: "draft" | "active" | "closed" | "archived";
  dataset_keys: string[];
};

export type ObservabilitySnapshot = {
  generated_at: string;
  health: "ok" | "degraded" | "down";
  api_latency_p50_ms: number;
  api_latency_p95_ms: number;
  failure_rate: number;
  active_sessions: number;
  queue_depth: number;
  estimated_hourly_cost_usd: number;
  scaling_hint: string;
};

export type EnterpriseAuditEvent = {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  outcome: "allowed" | "denied" | "error";
  resource_type: string;
  resource_id: string | null;
  at: string;
  metadata: Record<string, unknown>;
};

export type WebhookEndpoint = {
  id: string;
  organization_id: string;
  url: string;
  events: string[];
  secret_ref: string;
  is_active: boolean;
};

export type IntegrationKind =
  | "lms"
  | "fhir"
  | "hl7"
  | "scorm"
  | "lti"
  | "oauth"
  | "saml"
  | "webhook";

export type IntegrationDescriptor = {
  kind: IntegrationKind;
  status: "ready" | "abstracted" | "disabled";
  notes: string;
};

export type TenantIsolationCheck = {
  ok: boolean;
  violations: string[];
};

export type EnterpriseSessionContext = {
  organization_id: string | null;
  membership_role: EnterpriseRole | null;
  campus_id: string | null;
  program_id: string | null;
};

export type EnterpriseBundle = {
  version_lock: EnterpriseVersionLock;
  context: EnterpriseSessionContext;
  dashboard: AnalyticsDashboard | null;
  certificates_issued: DigitalCertificate[];
  longitudinal: LongitudinalTrack | null;
  observability: ObservabilitySnapshot | null;
  ownership: string;
};

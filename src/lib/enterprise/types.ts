/**
 * VPsych Enterprise Institutional types (Mission 18).
 */

export type EnterpriseMembershipRole =
  | "student"
  | "resident"
  | "psychologist"
  | "gp"
  | "faculty"
  | "instructor"
  | "program_director"
  | "institution_admin";

/** Platform auth roles (profiles.role). admin = Super Administrator. */
export type PlatformRole = "therapist" | "admin";

export type AssignmentStatus = "draft" | "published" | "closed" | "archived";

export type AssignmentCompletionStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "passed"
  | "failed"
  | "excused";

export type Institution = {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
  country_code: string;
  timezone: string;
  locale_default: string;
  sso_enabled: boolean;
  sso_provider?: string | null;
  sso_metadata?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Department = {
  id: string;
  institution_id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

export type Program = {
  id: string;
  institution_id: string;
  department_id?: string | null;
  slug: string;
  name: string;
  degree_type?: string | null;
  is_active: boolean;
};

export type AcademicYear = {
  id: string;
  institution_id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

export type Term = {
  id: string;
  institution_id: string;
  academic_year_id: string;
  slug: string;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

export type Cohort = {
  id: string;
  institution_id: string;
  program_id?: string | null;
  academic_year_id?: string | null;
  slug: string;
  name: string;
  intake_label?: string | null;
  is_active: boolean;
};

export type ClassGroup = {
  id: string;
  institution_id: string;
  cohort_id?: string | null;
  term_id?: string | null;
  program_id?: string | null;
  slug: string;
  name: string;
  group_label?: string | null;
  capacity?: number | null;
  is_active: boolean;
};

export type InstitutionMembership = {
  id: string;
  institution_id: string;
  user_id: string;
  role: EnterpriseMembershipRole;
  department_id?: string | null;
  program_id?: string | null;
  cohort_id?: string | null;
  is_primary: boolean;
  is_active: boolean;
};

export type LearningAssignment = {
  id: string;
  institution_id: string;
  class_id?: string | null;
  cohort_id?: string | null;
  created_by?: string | null;
  title: string;
  description?: string | null;
  status: AssignmentStatus;
  is_required: boolean;
  is_elective: boolean;
  due_at?: string | null;
  opens_at?: string | null;
  scenario_template_slug?: string | null;
  instructor_preset_slug?: string | null;
  required_competency_ids: string[];
  pass_threshold: number;
  max_attempts: number;
  metadata?: Record<string, unknown>;
};

export type AssignmentCompletion = {
  id: string;
  assignment_id: string;
  user_id: string;
  session_id?: string | null;
  status: AssignmentCompletionStatus;
  attempt_number: number;
  score?: number | null;
  submitted_at?: string | null;
  feedback?: string | null;
};

export type InstitutionTree = {
  institution: Institution;
  departments: Department[];
  programs: Program[];
  academic_years: AcademicYear[];
  terms: Term[];
  cohorts: Cohort[];
  classes: ClassGroup[];
  memberships: InstitutionMembership[];
  assignments: LearningAssignment[];
};

/** Clinical Validation Program — domain types. */

export const CVP_PROTOCOL_VERSION = "1.0";
export const CVP_CONSENT_VERSION = "1.0";
export const CVP_AGREEMENT_VERSION = "1.0";

export type StudyStatus = "draft" | "active" | "closed" | "archived";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export type StudyRole =
  | "reviewer"
  | "supervisor"
  | "resident"
  | "coordinator"
  | "blind_scorer";

export type AllocationArm =
  | "standard"
  | "blind_challenge"
  | "calibration"
  | "control";

export type AssignmentStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "expired";

export type OutcomeTimepoint = "baseline" | "post" | "followup";

export type ExportKind =
  | "ratings_csv"
  | "consort_summary"
  | "publication_package"
  | "institution_comparison"
  | "reliability_report"
  | "deidentified_full";

export type DeidentifyLevel = "none" | "standard" | "strict";

export type CvpStudy = {
  id: string;
  slug: string;
  title: string;
  protocol_version: string;
  status: StudyStatus;
  irb_reference: string | null;
  consort_registered: boolean;
  description: string | null;
  settings: Record<string, unknown>;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
};

export type CvpEnrollment = {
  id: string;
  study_id: string;
  profile_id: string;
  institution_id: string | null;
  role_in_study: string;
  consent_version: string;
  consent_at: string;
  is_active: boolean;
  created_at: string;
};

export type CvpAssignment = {
  id: string;
  study_id: string;
  enrollment_id: string;
  avatar_id: string;
  allocation_arm: AllocationArm;
  allocation_seed: string;
  sequence_index: number;
  status: AssignmentStatus;
  session_id: string | null;
  assigned_at: string;
  due_at: string | null;
  completed_at: string | null;
};

export type InterRaterResult = {
  method: string;
  value: number | null;
  n_items: number;
  n_raters: number;
  interpretation: string;
  notes: string;
};

export type ReliabilityReport = {
  cronbach_alpha: number | null;
  cohens_kappa: InterRaterResult | null;
  fleiss_kappa: InterRaterResult | null;
  icc: InterRaterResult | null;
  pearson_inter_rater: number | null;
  sample_sessions: number;
  sample_raters: number;
  generated_at: string;
  disclaimer: string;
};

export type ConsortFlow = {
  assessed_for_eligibility: number;
  excluded: number;
  randomized: number;
  allocated_intervention: number;
  allocated_control: number;
  received_intervention: number;
  completed_followup: number;
  analysed: number;
  notes: string[];
};

export type InstitutionComparisonRow = {
  institution_id: string;
  institution_name: string;
  site_code: string | null;
  enrollments: number;
  completed_assignments: number;
  avg_realism: number | null;
  avg_educational_value: number | null;
  blind_scores: number;
};

export type EducationalOutcomeSummary = {
  instrument_slug: string;
  baseline_n: number;
  post_n: number;
  followup_n: number;
  baseline_mean: number | null;
  post_mean: number | null;
  mean_change: number | null;
  paired_n: number;
};

export type CvpDashboard = {
  study: Pick<
    CvpStudy,
    "id" | "slug" | "title" | "status" | "irb_reference" | "protocol_version"
  > | null;
  enrollments: { total: number; active: number };
  invitations: { pending: number; accepted: number; expired: number };
  assignments: {
    pending: number;
    active: number;
    completed: number;
    by_arm: Record<string, number>;
  };
  blind_challenge: {
    scores: number;
    avg_realism: number | null;
    would_use_pct: number | null;
  };
  reliability: ReliabilityReport;
  consort: ConsortFlow;
  institutions: InstitutionComparisonRow[];
  outcomes: EducationalOutcomeSummary[];
  longitudinal: {
    snapshots: number;
    reviewers_with_2plus_snapshots: number;
  };
  calibration: {
    items: number;
    with_expert_scores: number;
  };
  exports: { completed: number; pending: number };
  generated_at: string;
  disclaimer: string;
};

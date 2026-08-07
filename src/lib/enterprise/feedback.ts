/**
 * Institutional pilot feedback — CIDP.
 *
 * Enterprise / ops owned. Collects structured feedback from faculty, residents,
 * researchers, administrators, and IT. Never writes patient clinical state.
 */

import { PACKAGE_VERSION } from "@/lib/ops/versions";

export const FEEDBACK_ROLES = [
  "faculty",
  "resident",
  "student",
  "supervisor",
  "clinician",
  "researcher",
  "administrator",
  "institution",
  "it",
] as const;

export type FeedbackRole = (typeof FEEDBACK_ROLES)[number];

export const FEEDBACK_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
  "wishlist",
] as const;

export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];

export const FEEDBACK_PRIORITIES = ["p0", "p1", "p2", "p3"] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

export const FEEDBACK_STATUSES = [
  "submitted",
  "triaged",
  "in_progress",
  "resolved",
  "wont_fix",
  "duplicate",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_REPRODUCIBILITY = [
  "always",
  "often",
  "sometimes",
  "rare",
  "unknown",
] as const;

export type FeedbackReproducibility =
  (typeof FEEDBACK_REPRODUCIBILITY)[number];

export const FEEDBACK_CATEGORIES = [
  "clinical_realism",
  "educational_value",
  "conversation_quality",
  "clinical_simulation",
  "assessment",
  "assessment_report",
  "curriculum",
  "supervisor",
  "supervisor_tools",
  "analytics",
  "research_export",
  "authentication",
  "performance",
  "voice_realtime",
  "security",
  "security_privacy",
  "enterprise_admin",
  "deployment",
  "documentation",
  "usability",
  "bug",
  "critical_safety",
  "other",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number] | string;

export type InstitutionalFeedbackInput = {
  /** Maps to DB column role_persona */
  submitter_role: FeedbackRole;
  institution_name: string;
  department?: string;
  institution_id?: string | null;
  category: string;
  severity: FeedbackSeverity;
  priority?: FeedbackPriority;
  reproducibility?: FeedbackReproducibility;
  title: string;
  body: string;
  suggested_action?: string;
  platform_version?: string;
  session_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type InstitutionalFeedbackRecord = {
  id: string;
  submitter_id: string;
  role_persona: FeedbackRole;
  institution_name: string;
  department: string;
  institution_id: string | null;
  category: string;
  severity: FeedbackSeverity;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  reproducibility: FeedbackReproducibility;
  title: string | null;
  body: string;
  suggested_action: string;
  platform_version: string;
  session_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FeedbackInsertRow = {
  role_persona: FeedbackRole;
  institution_name: string;
  department: string;
  institution_id: string | null;
  category: string;
  severity: FeedbackSeverity;
  priority: FeedbackPriority;
  status: "submitted";
  reproducibility: FeedbackReproducibility;
  title: string;
  body: string;
  suggested_action: string;
  platform_version: string;
  session_id: string | null;
  metadata: Record<string, unknown>;
};

export type FeedbackValidationResult =
  | { ok: true; value: FeedbackInsertRow }
  | { ok: false; error: string };

const PHI_HINT =
  /\b(ssn|social security|mrn|medical record|dob\b|date of birth|patient name is|real patient)\b/i;

function includes<T extends string>(list: readonly T[], v: string): v is T {
  return (list as readonly string[]).includes(v);
}

/** Default priority from severity for triage. */
export function defaultPriorityForSeverity(
  severity: FeedbackSeverity,
): FeedbackPriority {
  switch (severity) {
    case "critical":
      return "p0";
    case "high":
      return "p1";
    case "medium":
      return "p2";
    case "low":
    case "wishlist":
      return "p3";
  }
}

export function validateFeedbackInput(
  raw: unknown,
): FeedbackValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = raw as Record<string, unknown>;

  const submitter_role = String(b.submitter_role ?? "");
  if (!includes(FEEDBACK_ROLES, submitter_role)) {
    return { ok: false, error: "Invalid submitter_role" };
  }

  const severity = String(b.severity ?? "medium");
  if (!includes(FEEDBACK_SEVERITIES, severity)) {
    return { ok: false, error: "Invalid severity" };
  }

  const reproducibility = String(b.reproducibility ?? "unknown");
  if (!includes(FEEDBACK_REPRODUCIBILITY, reproducibility)) {
    return { ok: false, error: "Invalid reproducibility" };
  }

  const priority = String(b.priority ?? defaultPriorityForSeverity(severity));
  if (!includes(FEEDBACK_PRIORITIES, priority)) {
    return { ok: false, error: "Invalid priority" };
  }

  const title = String(b.title ?? "").trim();
  const body = String(b.body ?? "").trim();
  const category = String(b.category ?? "").trim().toLowerCase();
  const institution_name = String(b.institution_name ?? "").trim();
  const department = String(b.department ?? "").trim();
  const suggested_action = String(b.suggested_action ?? "").trim();
  const platform_version = String(
    b.platform_version ?? PACKAGE_VERSION,
  ).trim();

  if (title.length < 3 || title.length > 200) {
    return { ok: false, error: "Title must be 3–200 characters" };
  }
  if (body.length < 10 || body.length > 8000) {
    return { ok: false, error: "Body must be 10–8000 characters" };
  }
  if (category.length < 2 || category.length > 80) {
    return { ok: false, error: "Invalid category" };
  }
  if (institution_name.length > 200) {
    return { ok: false, error: "Institution name too long" };
  }
  if (department.length > 120) {
    return { ok: false, error: "Department too long" };
  }
  if (suggested_action.length > 2000) {
    return { ok: false, error: "Suggested action too long" };
  }

  const combined = `${title}\n${body}\n${suggested_action}`;
  if (PHI_HINT.test(combined)) {
    return {
      ok: false,
      error:
        "Possible identifiable / clinical PHI detected. Use fictional session IDs only; do not include real patient data.",
    };
  }

  const institution_id =
    typeof b.institution_id === "string" && b.institution_id.length > 0
      ? b.institution_id
      : null;
  const session_id =
    typeof b.session_id === "string" && b.session_id.length > 0
      ? b.session_id
      : null;

  return {
    ok: true,
    value: {
      role_persona: submitter_role,
      institution_name,
      department,
      institution_id,
      category,
      severity,
      priority,
      reproducibility,
      title,
      body,
      suggested_action,
      platform_version,
      session_id,
      status: "submitted",
      metadata:
        b.metadata && typeof b.metadata === "object"
          ? (b.metadata as Record<string, unknown>)
          : {},
    },
  };
}

export type FeedbackAdminPatch = {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  severity?: FeedbackSeverity;
  suggested_action?: string;
};

export function validateFeedbackAdminPatch(
  raw: unknown,
): { ok: true; value: FeedbackAdminPatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = raw as Record<string, unknown>;
  const value: FeedbackAdminPatch = {};

  if (b.status !== undefined) {
    const s = String(b.status);
    if (!includes(FEEDBACK_STATUSES, s)) {
      return { ok: false, error: "Invalid status" };
    }
    value.status = s;
  }
  if (b.priority !== undefined) {
    const p = String(b.priority);
    if (!includes(FEEDBACK_PRIORITIES, p)) {
      return { ok: false, error: "Invalid priority" };
    }
    value.priority = p;
  }
  if (b.severity !== undefined) {
    const sev = String(b.severity);
    if (!includes(FEEDBACK_SEVERITIES, sev)) {
      return { ok: false, error: "Invalid severity" };
    }
    value.severity = sev;
  }
  if (b.suggested_action !== undefined) {
    const a = String(b.suggested_action).trim();
    if (a.length > 2000) {
      return { ok: false, error: "Suggested action too long" };
    }
    value.suggested_action = a;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, error: "No updatable fields" };
  }
  return { ok: true, value };
}

export function summarizeFeedback(
  rows: Array<{
    severity: FeedbackSeverity | string;
    status: FeedbackStatus | string;
    role_persona?: string;
    submitter_role?: string;
  }>,
): {
  total: number;
  open_critical: number;
  by_status: Record<string, number>;
  by_role: Record<string, number>;
  by_severity: Record<string, number>;
} {
  const by_status: Record<string, number> = {};
  const by_role: Record<string, number> = {};
  const by_severity: Record<string, number> = {};
  let open_critical = 0;

  for (const r of rows) {
    const role = r.role_persona ?? r.submitter_role ?? "unknown";
    by_status[r.status] = (by_status[r.status] ?? 0) + 1;
    by_role[role] = (by_role[role] ?? 0) + 1;
    by_severity[r.severity] = (by_severity[r.severity] ?? 0) + 1;
    if (
      r.severity === "critical" &&
      r.status !== "resolved" &&
      r.status !== "wont_fix" &&
      r.status !== "duplicate"
    ) {
      open_critical += 1;
    }
  }

  return {
    total: rows.length,
    open_critical,
    by_status,
    by_role,
    by_severity,
  };
}

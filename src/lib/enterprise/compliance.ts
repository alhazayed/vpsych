/**
 * Compliance readiness assessment (FERPA / GDPR / HIPAA-where-applicable).
 */

export type ComplianceFramework = "FERPA" | "GDPR" | "HIPAA" | "INSTITUTIONAL_PRIVACY";

export type ComplianceControl = {
  id: string;
  framework: ComplianceFramework;
  title: string;
  status: "implemented" | "partial" | "missing" | "not_applicable";
  evidence: string;
  recommendation?: string;
};

export type ComplianceAssessment = {
  controls: ComplianceControl[];
  scores: Record<ComplianceFramework, number>;
  overall: number;
  hipaa_certified: false;
  notes: string[];
};

function scoreControls(controls: ComplianceControl[]): number {
  if (!controls.length) return 0;
  const weights = { implemented: 1, partial: 0.55, missing: 0, not_applicable: 1 };
  const sum = controls.reduce((a, c) => a + weights[c.status], 0);
  return Math.round((sum / controls.length) * 100);
}

export function assessCompliance(): ComplianceAssessment {
  const controls: ComplianceControl[] = [
    {
      id: "ferpa-access",
      framework: "FERPA",
      title: "Role-based access to education records",
      status: "partial",
      evidence: "RLS + institution memberships; education-record classification pending",
      recommendation: "Tag session/report rows as education records; faculty-only exports",
    },
    {
      id: "ferpa-directory",
      framework: "FERPA",
      title: "Directory information controls",
      status: "partial",
      evidence:
        "Learner lists are faculty/admin scoped via memberships + RLS; no public directory API",
      recommendation: "Add explicit directory-info opt-out preference on learner profiles",
    },
    {
      id: "ferpa-audit",
      framework: "FERPA",
      title: "Access auditability",
      status: "partial",
      evidence: "security_audit_events for admin gates; institution analytics admin-gated",
      recommendation: "Log faculty viewing of learner education records",
    },
    {
      id: "gdpr-lawful-basis",
      framework: "GDPR",
      title: "Lawful basis / DPA scaffolding",
      status: "partial",
      evidence: "Institution settings JSON can store DPA refs; SSO/enterprise onboarding contract documented",
      recommendation: "Institution onboarding UI captures DPA + lawful basis",
    },
    {
      id: "gdpr-dsar",
      framework: "GDPR",
      title: "Data subject access / erasure",
      status: "partial",
      evidence:
        "Anonymous research export API implemented; full subject erasure workflow not yet automated",
      recommendation: "Build delete-subject pipeline with audit trail",
    },
    {
      id: "gdpr-minimisation",
      framework: "GDPR",
      title: "Data minimisation for research",
      status: "implemented",
      evidence: "Anonymous research export with hashed subject_id + PII key guard",
    },
    {
      id: "gdpr-retention",
      framework: "GDPR",
      title: "Retention schedule",
      status: "partial",
      evidence:
        "Retention policy may be stored in institutions.settings; automated purge jobs not shipped",
      recommendation: "Per-institution retention policy + scheduled purge",
    },
    {
      id: "hipaa-scope",
      framework: "HIPAA",
      title: "PHI / BAA posture",
      status: "not_applicable",
      evidence:
        "VPsych is an educational simulator with synthetic patients — not a covered entity EHR by default",
      recommendation:
        "If real patient data ever enters, require BAA + HIPAA program; currently not certified",
    },
    {
      id: "hipaa-access",
      framework: "HIPAA",
      title: "Access controls & audit",
      status: "partial",
      evidence: "Authn/z + security_audit_events; no HIPAA designation",
    },
    {
      id: "privacy-policy",
      framework: "INSTITUTIONAL_PRIVACY",
      title: "Privacy policy surface",
      status: "partial",
      evidence: "Login/signup footer labels; policy content not implemented in-app",
      recommendation: "Publish institutional privacy + ToS pages",
    },
    {
      id: "tenant-isolation",
      framework: "INSTITUTIONAL_PRIVACY",
      title: "Institution isolation",
      status: "implemented",
      evidence: "institutions + memberships + RLS helpers + app tenant filter",
    },
    {
      id: "academic-audit",
      framework: "INSTITUTIONAL_PRIVACY",
      title: "Academic auditability",
      status: "partial",
      evidence: "Assignments, completions, version_lock on research export",
      recommendation: "Immutable gradebook export for registrars",
    },
  ];

  const frameworks: ComplianceFramework[] = [
    "FERPA",
    "GDPR",
    "HIPAA",
    "INSTITUTIONAL_PRIVACY",
  ];
  const scores = Object.fromEntries(
    frameworks.map((f) => [
      f,
      scoreControls(controls.filter((c) => c.framework === f)),
    ]),
  ) as Record<ComplianceFramework, number>;

  const overall = Math.round(
    frameworks.reduce((a, f) => a + scores[f], 0) / frameworks.length,
  );

  return {
    controls,
    scores,
    overall,
    hipaa_certified: false,
    notes: [
      "HIPAA certification is explicitly NOT claimed.",
      "Educational use with synthetic patients reduces PHI exposure; still apply institutional privacy.",
      "GDPR DSAR and retention remain High recommendations for EU deployments.",
    ],
  };
}

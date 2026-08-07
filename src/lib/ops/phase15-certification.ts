/**
 * Phase 15 — Certification workstream status aggregators.
 * Documents evidence readiness; does not invent drill or pen-test results.
 */

export type CertificationStatus = "PASS" | "PARTIAL" | "OPEN" | "FAIL";

export type CertificationCheck = {
  id: string;
  label: string;
  status: CertificationStatus;
  evidence: string;
  notes?: string;
};

export type WorkstreamCertification = {
  workstream:
    | "security"
    | "disaster_recovery"
    | "infrastructure"
    | "clinical"
    | "educational"
    | "research"
    | "operational";
  generated_at: string;
  overall: CertificationStatus;
  checks: CertificationCheck[];
  reviewer_placeholder: string;
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  digital_signature_placeholder: string;
};

function overallOf(checks: CertificationCheck[]): CertificationStatus {
  if (checks.some((c) => c.status === "FAIL")) return "FAIL";
  if (checks.every((c) => c.status === "PASS")) return "PASS";
  if (checks.some((c) => c.status === "OPEN" || c.status === "FAIL")) {
    return checks.some((c) => c.status === "PASS" || c.status === "PARTIAL")
      ? "PARTIAL"
      : "OPEN";
  }
  return "PARTIAL";
}

function wrap(
  workstream: WorkstreamCertification["workstream"],
  checks: CertificationCheck[],
): WorkstreamCertification {
  return {
    workstream,
    generated_at: new Date().toISOString(),
    overall: overallOf(checks),
    checks,
    reviewer_placeholder: "[Reviewer Name / Role]",
    approval_status: "PENDING",
    digital_signature_placeholder: "[Digital Signature / Attestation]",
  };
}

/** Default Phase 15 packaging status — honest residuals, no fabricated drills. */
export function buildSecurityCertification(): WorkstreamCertification {
  return wrap("security", [
    {
      id: "dependency_audit",
      label: "Dependency audit (npm audit high+)",
      status: "PASS",
      evidence: "npm run audit:deps — 0 vulnerabilities",
    },
    {
      id: "vulnerability_remediation",
      label: "Vulnerability remediation",
      status: "PASS",
      evidence: "No high/critical npm advisories at Phase 15 packaging",
    },
    {
      id: "access_review",
      label: "Access review (RBAC / admin gates)",
      status: "PASS",
      evidence: "architecture tests + requireApiAdmin on ops routes",
    },
    {
      id: "audit_log_validation",
      label: "Audit log validation",
      status: "PARTIAL",
      evidence: "security_audit_events + enterprise_audit_events present",
    },
    {
      id: "secret_rotation",
      label: "Secret rotation evidence",
      status: "OPEN",
      evidence: "docs/cidp/evidence/security/ — rotation tabletop pending",
    },
    {
      id: "penetration_testing",
      label: "Penetration testing",
      status: "OPEN",
      evidence: "External/internal pen-test pack not attached",
    },
    {
      id: "hibp",
      label: "Leaked-password protection (HIBP)",
      status: "OPEN",
      evidence: "SEC-S12-01 residual",
    },
    {
      id: "apm",
      label: "Production APM / error monitoring",
      status: "OPEN",
      evidence: "SEC-S12-03 Sentry residual",
    },
  ]);
}

export function buildDisasterRecoveryCertification(): WorkstreamCertification {
  return wrap("disaster_recovery", [
    {
      id: "dr_drill",
      label: "Disaster Recovery drill",
      status: "OPEN",
      evidence: "docs/cidp/evidence/dr/DR_EVIDENCE_LOG.md empty",
    },
    {
      id: "pitr",
      label: "Point-in-Time Recovery",
      status: "OPEN",
      evidence: "No PITR drill row",
    },
    {
      id: "backup_validation",
      label: "Backup validation",
      status: "OPEN",
      evidence: "Awaiting operator timestamp",
    },
    {
      id: "restore_validation",
      label: "Restore validation",
      status: "OPEN",
      evidence: "Staging restore not evidenced",
    },
    {
      id: "failover",
      label: "Infrastructure failover",
      status: "OPEN",
      evidence: "Vercel rollback tabletop pending signed evidence",
    },
    {
      id: "procedures",
      label: "DR procedures documented",
      status: "PASS",
      evidence: "docs/DISASTER_RECOVERY.md + cidp/DISASTER_RECOVERY_REPORT.md",
    },
  ]);
}

export function buildInfrastructureCertification(): WorkstreamCertification {
  return wrap("infrastructure", [
    {
      id: "ci_green",
      label: "Engineering quality gates",
      status: "PASS",
      evidence: "lint/typecheck/test/migrations local green at packaging",
    },
    {
      id: "health",
      label: "Liveness / health probe",
      status: "PASS",
      evidence: "/api/health + Stage 12 ops snapshot",
    },
    {
      id: "rate_limits",
      label: "Rate limiting on Route Handlers",
      status: "PASS",
      evidence: "architecture + Stage 12 admin RL",
    },
    {
      id: "upstash",
      label: "Distributed rate-limit (Upstash)",
      status: "PARTIAL",
      evidence: "SEC-S12-02 confirm in production",
    },
    {
      id: "scaling",
      label: "Scaling behaviour under pilot load",
      status: "OPEN",
      evidence: "Awaiting pilot observation",
    },
  ]);
}

export function buildClinicalCertification(): WorkstreamCertification {
  return wrap("clinical", [
    {
      id: "fictional_sp",
      label: "Fictional standardized patient policy",
      status: "PASS",
      evidence: "FICTIONAL_PATIENT_CERTIFICATION + Stage 12/CIDP attestations",
    },
    {
      id: "ownership_freeze",
      label: "Clinical Core ownership freeze",
      status: "PASS",
      evidence: "ENGINE_OWNERSHIP Phase 14/15 notes + architecture tests",
    },
    {
      id: "realism",
      label: "Clinical realism evidence pack",
      status: "PARTIAL",
      evidence: "Stage 8 observational; pilot log empty",
    },
    {
      id: "supervisor_agreement",
      label: "Supervisor agreement evidence",
      status: "PARTIAL",
      evidence: "Supervisor platform present; pilot aggregates pending",
    },
    {
      id: "dsm_icd",
      label: "DSM/ICD consistency checks",
      status: "PARTIAL",
      evidence: "Scenario validator coherence only — never assigns diagnoses",
    },
    {
      id: "score_validation",
      label: "Competency score scientific validation",
      status: "OPEN",
      evidence: "Explicitly unvalidated — blocks validated-score claims",
      notes: "Does not by itself block training GA if Board scopes validation as observational",
    },
    {
      id: "clinical_safety",
      label: "Clinical safety (no PHI workflows)",
      status: "PASS",
      evidence: "PHI heuristics + admin-only reports",
    },
  ]);
}

export function buildEducationalCertification(): WorkstreamCertification {
  return wrap("educational", [
    {
      id: "curriculum_engines",
      label: "Education / ACE / CGE present",
      status: "PASS",
      evidence: "Stages 7–9 on main",
    },
    {
      id: "faculty_satisfaction",
      label: "Faculty satisfaction evidence",
      status: "OPEN",
      evidence: "Awaiting pilot surveys",
    },
    {
      id: "resident_progression",
      label: "Resident progression evidence",
      status: "OPEN",
      evidence: "Awaiting pilot observation weeks",
    },
    {
      id: "certification_outcomes",
      label: "Certification outcomes",
      status: "OPEN",
      evidence: "Enterprise certs available; pilot completions pending",
    },
  ]);
}

export function buildResearchCertification(): WorkstreamCertification {
  return wrap("research", [
    {
      id: "validation_platform",
      label: "Scientific validation platform",
      status: "PASS",
      evidence: "Stage 8 lib/validation",
    },
    {
      id: "export_pipeline",
      label: "Research export pipeline",
      status: "PASS",
      evidence: "/api/admin/research/export + de-ID rules",
    },
    {
      id: "multicentre_datasets",
      label: "Multicentre publication datasets",
      status: "OPEN",
      evidence: "Awaiting participating sites + sealed exports",
    },
    {
      id: "statistical_summaries",
      label: "Statistical summaries (no fabricated significance)",
      status: "PARTIAL",
      evidence: "Engines refuse significance fabrication; pilot N pending",
    },
  ]);
}

export function buildOperationalCertification(): WorkstreamCertification {
  return wrap("operational", [
    {
      id: "availability",
      label: "System availability monitoring",
      status: "PARTIAL",
      evidence: "Health + CIDP dashboards; APM residual",
    },
    {
      id: "api_reliability",
      label: "API reliability controls",
      status: "PASS",
      evidence: "Rate limits, sanitized errors, request IDs",
    },
    {
      id: "realtime_voice",
      label: "Realtime / voice performance budgets",
      status: "PARTIAL",
      evidence: "Stage 11 budgets documented; pilot soak pending",
    },
    {
      id: "db_health",
      label: "Database health / migration parity tooling",
      status: "PASS",
      evidence: "test:migrations + Stage 12 guides",
    },
  ]);
}

export type Phase15CertificationBundle = {
  generated_at: string;
  security: WorkstreamCertification;
  disaster_recovery: WorkstreamCertification;
  infrastructure: WorkstreamCertification;
  clinical: WorkstreamCertification;
  educational: WorkstreamCertification;
  research: WorkstreamCertification;
  operational: WorkstreamCertification;
};

export function buildPhase15Certifications(): Phase15CertificationBundle {
  return {
    generated_at: new Date().toISOString(),
    security: buildSecurityCertification(),
    disaster_recovery: buildDisasterRecoveryCertification(),
    infrastructure: buildInfrastructureCertification(),
    clinical: buildClinicalCertification(),
    educational: buildEducationalCertification(),
    research: buildResearchCertification(),
    operational: buildOperationalCertification(),
  };
}

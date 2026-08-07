/**
 * Phase 14 — Continuous risk register (product/ops/clinical-governance).
 * Distinct from clinical patient RISK_MODEL (SI/HTO flags).
 * Never stores PHI or clinical_snapshot content.
 */

export const RISK_LIKELIHOODS = ["rare", "unlikely", "possible", "likely", "almost_certain"] as const;
export const RISK_IMPACTS = ["negligible", "minor", "moderate", "major", "severe"] as const;
export const RISK_STATUSES = ["open", "mitigating", "accepted", "closed"] as const;

export type RiskLikelihood = (typeof RISK_LIKELIHOODS)[number];
export type RiskImpact = (typeof RISK_IMPACTS)[number];
export type RiskStatus = (typeof RISK_STATUSES)[number];

export type PilotRisk = {
  id: string;
  description: string;
  likelihood: RiskLikelihood;
  impact: RiskImpact;
  owner: string;
  mitigation: string;
  status: RiskStatus;
  review_date: string;
  escalation_path: string;
  category:
    | "clinical_safety"
    | "security"
    | "operations"
    | "educational"
    | "research"
    | "governance"
    | "infrastructure";
};

export type RiskRegisterSummary = {
  generated_at: string;
  total: number;
  open: number;
  critical_open: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  unresolved: Array<{
    id: string;
    description: string;
    likelihood: RiskLikelihood;
    impact: RiskImpact;
    owner: string;
    status: RiskStatus;
  }>;
  executive_summary: string;
};

const LIKELIHOOD_SCORE: Record<RiskLikelihood, number> = {
  rare: 1,
  unlikely: 2,
  possible: 3,
  likely: 4,
  almost_certain: 5,
};

const IMPACT_SCORE: Record<RiskImpact, number> = {
  negligible: 1,
  minor: 2,
  moderate: 3,
  major: 4,
  severe: 5,
};

export function riskScore(risk: PilotRisk): number {
  return LIKELIHOOD_SCORE[risk.likelihood] * IMPACT_SCORE[risk.impact];
}

/** Score ≥ 15 or severe impact → treated as critical for GA gating. */
export function isCriticalRisk(risk: PilotRisk): boolean {
  return risk.impact === "severe" || riskScore(risk) >= 15;
}

export function summarizeRiskRegister(risks: PilotRisk[]): RiskRegisterSummary {
  const by_status: Record<string, number> = {};
  const by_category: Record<string, number> = {};
  let open = 0;
  let critical_open = 0;
  const unresolved: RiskRegisterSummary["unresolved"] = [];

  for (const r of risks) {
    by_status[r.status] = (by_status[r.status] ?? 0) + 1;
    by_category[r.category] = (by_category[r.category] ?? 0) + 1;
    if (r.status === "open" || r.status === "mitigating") {
      open += 1;
      unresolved.push({
        id: r.id,
        description: r.description,
        likelihood: r.likelihood,
        impact: r.impact,
        owner: r.owner,
        status: r.status,
      });
      if (isCriticalRisk(r)) critical_open += 1;
    }
  }

  unresolved.sort((a, b) => {
    const ra = risks.find((x) => x.id === a.id)!;
    const rb = risks.find((x) => x.id === b.id)!;
    return riskScore(rb) - riskScore(ra);
  });

  return {
    generated_at: new Date().toISOString(),
    total: risks.length,
    open,
    critical_open,
    by_status,
    by_category,
    unresolved,
    executive_summary:
      critical_open > 0
        ? `${critical_open} critical-tier risk(s) unresolved — GA blocked.`
        : open > 0
          ? `${open} open/mitigating risk(s); no critical-tier open — continue CIDP observation.`
          : "No open risks in register — verify evidence freshness before GA motion.",
  };
}

/** Seed residuals known at Phase 14 packaging (no secrets / no PHI). */
export function defaultPhase14RiskRegister(): PilotRisk[] {
  const review = "2026-08-21";
  return [
    {
      id: "RISK-P14-01",
      description:
        "Disaster Recovery / PITR live drill not yet evidenced — blocks GA.",
      likelihood: "possible",
      impact: "major",
      owner: "DevSecOps Lead",
      mitigation: "Execute staging PITR drill; append DR_EVIDENCE_LOG; Board review.",
      status: "open",
      review_date: review,
      escalation_path: "Release Board → DevSecOps → RM",
      category: "infrastructure",
    },
    {
      id: "RISK-P14-02",
      description:
        "Competency / assessment scores not scientifically validated — marketing overclaim risk.",
      likelihood: "likely",
      impact: "major",
      owner: "Clinical Governance Lead",
      mitigation:
        "Publish limitations; forbid validated-score claims; Stage 8 observational only.",
      status: "mitigating",
      review_date: review,
      escalation_path: "Clinical Governance → Release Board",
      category: "clinical_safety",
    },
    {
      id: "RISK-P14-03",
      description:
        "Production APM / Sentry monitoring incomplete — delayed incident detection.",
      likelihood: "possible",
      impact: "moderate",
      owner: "DevSecOps Lead",
      mitigation: "Enable error monitoring; wire CIDP alert catalog.",
      status: "open",
      review_date: review,
      escalation_path: "Ops → Release Manager",
      category: "operations",
    },
    {
      id: "RISK-P14-04",
      description:
        "Supabase Auth leaked-password protection residual (HIBP) may remain disabled.",
      likelihood: "possible",
      impact: "moderate",
      owner: "DevSecOps Lead",
      mitigation: "Enable HIBP in Auth settings; record in SECURITY_EVIDENCE_LOG.",
      status: "open",
      review_date: review,
      escalation_path: "Security → Release Board",
      category: "security",
    },
    {
      id: "RISK-P14-05",
      description:
        "Institution memberships sparse — pilot analytics may under-count faculty/residents.",
      likelihood: "likely",
      impact: "minor",
      owner: "Enterprise Program Manager",
      mitigation: "Onboard memberships per INSTITUTIONAL_DEPLOYMENT_CHECKLIST.",
      status: "mitigating",
      review_date: review,
      escalation_path: "Enterprise → Product Owner",
      category: "educational",
    },
    {
      id: "RISK-P14-06",
      description:
        "Feature freeze breach — accidental Clinical Core / cognition change during pilot.",
      likelihood: "unlikely",
      impact: "severe",
      owner: "Chief Software Architect",
      mitigation:
        "Architecture tests + RDL engineering rules; reject cognition PRs without Board unlock.",
      status: "mitigating",
      review_date: review,
      escalation_path: "Architect → Release Board",
      category: "governance",
    },
  ];
}

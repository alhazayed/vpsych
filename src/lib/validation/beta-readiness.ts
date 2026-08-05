/**
 * Workstream G — Beta readiness assessment + verdict.
 */

import type { BetaReadinessAssessment, BetaVerdict } from "@/lib/validation/types";
import { VALIDATION_PROGRAM_VERSION } from "@/lib/validation/types";

export type BetaReadinessInput = {
  /** Structural engineering indices available today (0–100 or null). */
  vqi?: number | null;
  cfi?: number | null;
  hcfi?: number | null;
  pmfi?: number | null;
  /** Human studies — null until data collected. */
  pas?: number | null;
  pas_n?: number;
  las?: number | null;
  las_n?: number;
  pab_pme_delta?: number | null;
  therapy_response_pass_rate?: number | null;
  conversation_quality_en?: number | null;
  conversation_quality_ar?: number | null;
  migration_applied?: boolean;
  regression_suite_green?: boolean;
};

function domain(
  id: string,
  score: number,
  evidence: string[],
  gaps: string[],
): BetaReadinessAssessment["domains"][number] {
  const status =
    score >= 75 ? "ready" : score >= 55 ? "conditional" : "not_ready";
  return { id, score, status, evidence, gaps };
}

export function assessBetaReadiness(
  input: BetaReadinessInput,
): BetaReadinessAssessment {
  const clinical = domain(
    "clinical_readiness",
    meanPresent([input.cfi, input.pmfi, input.hcfi, input.pas]),
    [
      input.cfi != null ? `CFI=${input.cfi}` : "CFI pending",
      input.pmfi != null ? `PMFI=${input.pmfi}` : "PMFI pending",
      input.pas != null
        ? `PAS=${input.pas} (n=${input.pas_n ?? 0})`
        : "PAS not yet collected (blind study pending)",
    ],
    input.pas == null || (input.pas_n ?? 0) < 8
      ? ["Complete psychiatrist blind study (PAS n≥8 consultants/residents)"]
      : [],
  );

  const educational = domain(
    "educational_readiness",
    meanPresent([input.las, input.hcfi, input.pmfi]),
    [
      input.las != null
        ? `LAS=${input.las} (n=${input.las_n ?? 0})`
        : "LAS not yet collected",
    ],
    input.las == null || (input.las_n ?? 0) < 20
      ? ["Run learner authenticity study across tracks"]
      : [],
  );

  const scientific = domain(
    "scientific_readiness",
    meanPresent([
      input.vqi,
      input.pas != null ? Math.min(100, 40 + (input.pas_n ?? 0) * 5) : 35,
      input.pab_pme_delta != null ? 60 + Math.max(-20, input.pab_pme_delta) : 45,
    ]),
    [
      "Validation protocols + PAS/LAS/PAB engines shipped (Mission 22)",
      input.vqi != null ? `VQI=${input.vqi}` : "VQI pending",
    ],
    [
      "No publication claim until PAS/LAS CIs published with preregistered protocol",
      "SP criterion arm required for PAB",
    ],
  );

  const operational = domain(
    "operational_readiness",
    meanPresent([
      input.regression_suite_green === false ? 40 : 85,
      input.migration_applied === false ? 50 : 80,
    ]),
    [
      input.regression_suite_green !== false
        ? "Regression suite green"
        : "Regression failing",
      input.migration_applied !== false
        ? "Migrations available in repo"
        : "Apply quality ledger migration before prod metrics",
    ],
    input.migration_applied === false
      ? ["Apply quality ledger / scientific migrations to target Supabase"]
      : [],
  );

  const conversation = domain(
    "conversation_quality",
    meanPresent([input.conversation_quality_en, input.conversation_quality_ar, input.hcfi]),
    [
      input.conversation_quality_en != null
        ? `EN auto-QC=${input.conversation_quality_en}`
        : "EN QC pending",
      input.conversation_quality_ar != null
        ? `AR auto-QC=${input.conversation_quality_ar}`
        : "AR QC pending",
    ],
    [
      "Independent EN and AR human review still required",
    ],
  );

  const research = domain(
    "research_readiness",
    meanPresent([
      70, // protocols exist
      input.pas_n && input.pas_n >= 8 ? 80 : 45,
      input.las_n && input.las_n >= 20 ? 80 : 45,
    ]),
    ["IRB-ready protocol docs under docs/validation/", "Export APIs present"],
    ["Secure blinded assignment + data lock before analysis"],
  );

  const domains = [
    clinical,
    educational,
    scientific,
    operational,
    conversation,
    research,
  ];
  const overall_score =
    Math.round((domains.reduce((a, d) => a + d.score, 0) / domains.length) * 10) /
    10;

  const verdict = decideVerdict({
    overall_score,
    domains,
    pas_n: input.pas_n ?? 0,
    las_n: input.las_n ?? 0,
    therapy_pass: input.therapy_response_pass_rate ?? null,
  });

  return {
    version: VALIDATION_PROGRAM_VERSION,
    assessed_at: new Date().toISOString(),
    domains,
    overall_score,
    verdict,
    recommended_participant_profile: [
      "≥4 consultant psychiatrists (blind PAS)",
      "≥4 psychiatry residents",
      "≥2 clinical psychologists",
      "≥20 learners (med students / GP / psych tracks) for LAS",
      "Optional: 2 SP educators for criterion arm",
    ],
    recommended_beta_size: {
      clinicians: 12,
      learners: 40,
      cases: 24,
    },
    success_criteria: [
      "PAS overall ≥ 70 with 95% CI lower bound ≥ 60 (n≥8)",
      "LAS overall ≥ 70 (n≥20)",
      "Suspected-AI rate ≤ 40% among consultants",
      "Therapy-response gradualism pass rate ≥ 80%",
      "No Critical regressions in CI (lint/typecheck/test/build)",
      "EN and AR conversation QC human-reviewed without high-severity AI tells",
    ],
    known_limitations: [
      "PAS/LAS human data not yet collected — framework ready, evidence pending",
      "PAB structural scaffolding is not a substitute for SP-blind criterion validity",
      "Arabic coverage currently centered on ar-JO; Gulf variants deferred",
      "Assessment competency scores remain unvalidated psychometrically",
      "Longitudinal multi-session human studies not yet run",
    ],
    risk_register: [
      {
        risk: "Overclaiming realism before blind study completes",
        likelihood: "high",
        impact: "high",
        mitigation: "Public verdict CONDITIONAL until PAS/LAS thresholds met; ban marketing claims",
      },
      {
        risk: "AI leakage / persona_fallback presented as model speech",
        likelihood: "medium",
        impact: "high",
        mitigation: "Keep aiSource propagation; QC flags; exclude fallback sessions from PAS packs",
      },
      {
        risk: "Learner distress from high-fidelity risk portrayals",
        likelihood: "medium",
        impact: "medium",
        mitigation: "Debrief protocol; crisis resources in Module 4; instructor oversight",
      },
      {
        risk: "Dialect mismatch reducing AR authenticity",
        likelihood: "medium",
        impact: "medium",
        mitigation: "Independent AR rater stream; native authors for expansions",
      },
    ],
    rationale: verdictRationale(verdict, overall_score, input),
  };
}

function meanPresent(xs: Array<number | null | undefined>): number {
  const vals = xs.filter((x): x is number => typeof x === "number");
  if (!vals.length) return 40;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function decideVerdict(opts: {
  overall_score: number;
  domains: BetaReadinessAssessment["domains"];
  pas_n: number;
  las_n: number;
  therapy_pass: number | null;
}): BetaVerdict {
  const notReady = opts.domains.filter((d) => d.status === "not_ready");
  if (notReady.length >= 3 || opts.overall_score < 45) return "NO_GO";

  // Human evidence absent → cannot GO TO EXPERT BETA as "validated";
  // but framework + engineering allow CONDITIONAL / LIMITED PILOT.
  if (opts.pas_n >= 8 && opts.las_n >= 20 && opts.overall_score >= 75) {
    return "GO_TO_EXPERT_BETA";
  }
  if (opts.pas_n >= 4 && opts.overall_score >= 65) {
    return "GO_TO_LIMITED_PILOT";
  }
  if (
    opts.overall_score >= 55 &&
    (opts.therapy_pass == null || opts.therapy_pass >= 70)
  ) {
    return "CONDITIONAL_GO";
  }
  return "NO_GO";
}

function verdictRationale(
  verdict: BetaVerdict,
  overall: number,
  input: BetaReadinessInput,
): string {
  if (verdict === "CONDITIONAL_GO") {
    return `Overall readiness ${overall}/100. Engineering + PME + validation framework are in place, but psychiatrist/learner human authenticity data are not yet collected (PAS n=${input.pas_n ?? 0}, LAS n=${input.las_n ?? 0}). Proceed only to protocol execution / expert recruitment — not broad beta marketing.`;
  }
  if (verdict === "GO_TO_LIMITED_PILOT") {
    return `Early human signal supports a limited supervised pilot while completing full PAS/LAS samples.`;
  }
  if (verdict === "GO_TO_EXPERT_BETA") {
    return `PAS/LAS thresholds met with supporting structural indices — expert beta authorized under protocol governance.`;
  }
  return `Readiness below threshold (${overall}/100). Close critical gaps before inviting external clinicians.`;
}

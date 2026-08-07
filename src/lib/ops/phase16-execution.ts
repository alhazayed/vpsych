/**
 * Phase 16 — Institutional pilot execution package composer.
 * Uses only supplied observations + explicit Evidence Pending.
 */

import {
  buildPhase16Dashboards,
  type Phase16DashboardBundle,
  type Phase16DashboardInput,
} from "@/lib/ops/phase16-dashboards";
import {
  buildInstitutionPilotDashboard,
  type InstitutionPilotDashboard,
  type InstitutionPilotProfile,
} from "@/lib/ops/phase16-institutions";
import {
  evaluatePhase16GaGates,
  PHASE16_CERT_ID,
  type Phase16GaEvaluation,
  type Phase16GaGateInput,
} from "@/lib/ops/phase16-ga-gates";
import {
  buildPhase16ExecutiveReport,
  type Phase16ExecutiveReport,
} from "@/lib/ops/phase16-reports";
import {
  defaultPhase14RiskRegister,
  summarizeRiskRegister,
  type RiskRegisterSummary,
} from "@/lib/ops/phase14-risk-register";
import { PACKAGE_VERSION } from "@/lib/ops/versions";

export type Phase16ExecutionInput = {
  institutions?: InstitutionPilotProfile[];
  dashboard?: Phase16DashboardInput;
  ga?: Phase16GaGateInput;
  period_ending?: string;
  risk_updates?: string[];
  outstanding_actions?: string[];
  lessons?: string[];
};

export type Phase16ExecutionPackage = {
  cert_id: string;
  package_version: string;
  generated_at: string;
  ownership: string;
  fabrication_policy: string;
  cidp_status: "GO";
  ga_status: "GO" | "NO-GO";
  authorized_version: "1.0.0" | null;
  institutions: InstitutionPilotDashboard;
  dashboards: Phase16DashboardBundle;
  ga: Phase16GaEvaluation;
  weekly_report: Phase16ExecutiveReport;
  monthly_report: Phase16ExecutiveReport;
  risks: RiskRegisterSummary;
  deliverables: string[];
  board_recommendation: string;
};

export function buildPhase16Execution(
  input: Phase16ExecutionInput = {},
): Phase16ExecutionPackage {
  const institutions = buildInstitutionPilotDashboard(input.institutions ?? []);
  const dashboards = buildPhase16Dashboards(input.dashboard ?? {});
  const riskSummary = summarizeRiskRegister(defaultPhase14RiskRegister());

  // Pilot objectives are Evidence Pending unless explicitly attested true.
  // Never infer "achieved" from empty or partial registries.
  const pilotObjectives = input.ga?.pilot_objectives_achieved === true;

  const ga = evaluatePhase16GaGates({
    ...(input.ga ?? {}),
    open_critical_feedback: input.ga?.open_critical_feedback ?? 0,
    open_critical_risks:
      input.ga?.open_critical_risks ?? riskSummary.critical_open,
    pilot_objectives_achieved: pilotObjectives,
  });

  const period =
    input.period_ending ?? new Date().toISOString().slice(0, 10);

  const reportBase = {
    dashboards,
    institutions,
    ga,
    risk_updates: input.risk_updates,
    outstanding_actions: input.outstanding_actions,
    lessons: input.lessons,
  };

  return {
    cert_id: PHASE16_CERT_ID,
    package_version: PACKAGE_VERSION,
    generated_at: new Date().toISOString(),
    ownership:
      "Phase 16 owns institutional pilot execution evidence, monitoring reports, and GA gate display only. Never writes Clinical Core, patient cognition, Supervisor AI, scientific validation, or Enterprise architecture.",
    fabrication_policy:
      "Do not fabricate pilot data, clinical outcomes, DR/PITR drills, pen-tests, feedback, or research evidence. Missing ⇒ Evidence Pending.",
    cidp_status: "GO",
    ga_status: ga.ga_status,
    authorized_version: ga.authorized_version,
    institutions,
    dashboards,
    ga,
    weekly_report: buildPhase16ExecutiveReport({
      kind: "weekly",
      period_ending: period,
      ...reportBase,
    }),
    monthly_report: buildPhase16ExecutiveReport({
      kind: "monthly",
      period_ending: period,
      ...reportBase,
    }),
    risks: riskSummary,
    deliverables: [
      "Institutional Pilot Dashboard",
      "Executive / Clinical / Education / Research / Security / Operations Dashboards",
      "Weekly Executive Reports",
      "Monthly Pilot Reports",
      "Risk Register",
      "Lessons Learned Register",
      "GA Readiness Dashboard",
      "Final Release Authorization Package (conditional on all gates PASS)",
    ],
    board_recommendation: ga.decision,
  };
}

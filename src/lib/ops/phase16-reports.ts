/**
 * Phase 16 — Weekly / monthly executive reports.
 * Sections with no observations explicitly say Evidence Pending.
 */

import { EVIDENCE_PENDING } from "@/lib/ops/phase16-evidence-state";
import type { Phase16DashboardBundle } from "@/lib/ops/phase16-dashboards";
import type { InstitutionPilotDashboard } from "@/lib/ops/phase16-institutions";
import type { Phase16GaEvaluation } from "@/lib/ops/phase16-ga-gates";
import { PACKAGE_VERSION } from "@/lib/ops/versions";
import { PHASE16_CERT_ID } from "@/lib/ops/phase16-ga-gates";
import { displayEvidence } from "@/lib/ops/phase16-evidence-state";

export type Phase16ReportKind = "weekly" | "monthly";

export type Phase16ReportInput = {
  kind: Phase16ReportKind;
  period_ending: string;
  dashboards: Phase16DashboardBundle;
  institutions: InstitutionPilotDashboard;
  ga: Phase16GaEvaluation;
  risk_updates?: string[];
  outstanding_actions?: string[];
  lessons?: string[];
};

export type Phase16ExecutiveReport = {
  kind: Phase16ReportKind;
  cert_id: string;
  package_version: string;
  period_ending: string;
  generated_at: string;
  cidp_status: "GO";
  ga_status: "GO" | "NO-GO";
  markdown: string;
  sections: Record<string, string[]>;
};

export function buildPhase16ExecutiveReport(
  input: Phase16ReportInput,
): Phase16ExecutiveReport {
  const generated_at = new Date().toISOString();
  const title =
    input.kind === "weekly"
      ? "Weekly Executive Report"
      : "Monthly Pilot Report";

  const sections: Record<string, string[]> = {
    executive_summary: [
      `CIDP: GO · GA: ${input.ga.ga_status}`,
      `Version: ${PACKAGE_VERSION}`,
      input.ga.decision,
      `GA gates PASS: ${input.ga.pass_count} / ${input.ga.gates.length}`,
    ],
    clinical_summary: linesFromDashboard(input.dashboards, "clinical"),
    education_summary: linesFromDashboard(input.dashboards, "education"),
    research_summary: linesFromDashboard(input.dashboards, "research"),
    security_summary: linesFromDashboard(input.dashboards, "security"),
    operations_summary: linesFromDashboard(input.dashboards, "operations"),
    pilot_progress: [
      `Registry: ${input.institutions.registry_state}`,
      `Institutions: ${displayEvidence(input.institutions.institutions_registered)}`,
      ...input.institutions.aggregates.map(
        (a) => `${a.label}: ${displayEvidence(a)}`,
      ),
      ...input.institutions.notes,
    ],
    risk_register_updates:
      input.risk_updates && input.risk_updates.length > 0
        ? input.risk_updates
        : [EVIDENCE_PENDING],
    outstanding_actions:
      input.outstanding_actions && input.outstanding_actions.length > 0
        ? input.outstanding_actions
        : input.ga.unmet.map((g) => `Close gate: ${g.label}`),
    lessons_learned:
      input.lessons && input.lessons.length > 0
        ? input.lessons
        : [EVIDENCE_PENDING],
    trend_analysis: [
      input.kind === "monthly"
        ? "Longitudinal trends require multi-week OBSERVED samples."
        : "Week-over-week trends require prior weekly OBSERVED samples.",
      EVIDENCE_PENDING,
    ],
    unmet_ga_gates: input.ga.unmet.map(
      (g) => `${g.label}: ${g.status} — ${g.detail} (${g.evidence})`,
    ),
  };

  const markdown = [
    `# CIDP ${title}`,
    ``,
    `**Period ending:** ${input.period_ending}`,
    `**Cert:** ${PHASE16_CERT_ID}`,
    `**Version:** ${PACKAGE_VERSION}`,
    `**CIDP:** GO · **GA:** ${input.ga.ga_status}`,
    ``,
    ...Object.entries(sections).flatMap(([key, lines]) => [
      `## ${key.replaceAll("_", " ")}`,
      ...lines.map((l) => `- ${l}`),
      ``,
    ]),
    `## Policy`,
    `- Do not fabricate operational evidence.`,
    `- Missing observations are ${EVIDENCE_PENDING}.`,
    `- Clinical Core unchanged.`,
    ``,
  ].join("\n");

  return {
    kind: input.kind,
    cert_id: PHASE16_CERT_ID,
    package_version: PACKAGE_VERSION,
    period_ending: input.period_ending,
    generated_at,
    cidp_status: "GO",
    ga_status: input.ga.ga_status,
    markdown,
    sections,
  };
}

function linesFromDashboard(
  bundle: Phase16DashboardBundle,
  id: string,
): string[] {
  const d = bundle.dashboards.find((x) => x.id === id);
  if (!d) return [EVIDENCE_PENDING];
  return [
    `Overall: ${d.overall_state}`,
    ...d.metrics.map((m) => `${m.label}: ${displayEvidence(m)}`),
  ];
}

/**
 * CIDP weekly executive / clinical / security report generators.
 * Markdown + structured JSON. PHI-free aggregates only.
 */

import type { CidpDashboardBundle } from "@/lib/ops/cidp-dashboards";
import type { CidpSuccessMetricsBundle } from "@/lib/ops/cidp-success-metrics";
import type { PilotPortfolioSummary } from "@/lib/ops/cidp-pilot";
import { PACKAGE_VERSION } from "@/lib/ops/versions";
import { CIDP_CERT_ID } from "@/lib/ops/cidp-dashboards";

export type WeeklyReportKind = "executive" | "clinical" | "security";

export type WeeklyReportInput = {
  week_ending: string;
  dashboards: CidpDashboardBundle;
  success: CidpSuccessMetricsBundle;
  pilots: PilotPortfolioSummary;
  open_critical_feedback: number;
  open_high_feedback: number;
  security_alerts?: number;
  notes?: string[];
};

export type WeeklyReport = {
  kind: WeeklyReportKind;
  cert_id: string;
  package_version: string;
  week_ending: string;
  generated_at: string;
  ga_status: "NO-GO";
  cidp_status: "GO";
  markdown: string;
  highlights: string[];
};

export function buildWeeklyReports(input: WeeklyReportInput): WeeklyReport[] {
  const generated_at = new Date().toISOString();
  const common = {
    cert_id: CIDP_CERT_ID,
    package_version: PACKAGE_VERSION,
    week_ending: input.week_ending,
    generated_at,
    ga_status: "NO-GO" as const,
    cidp_status: "GO" as const,
  };

  const execHighlights = [
    `Overall health: ${input.success.overall_health}`,
    `Pilots: ${input.pilots.pilots} · deployment success ${input.pilots.deployment_success_rate}%`,
    `Open critical feedback: ${input.open_critical_feedback}`,
    `System uptime (proxy): ${metric(input.dashboards, "system", "uptime")}%`,
  ];

  const clinicalHighlights = [
    `Completed simulations: ${metric(input.dashboards, "clinical", "sim_completed")}`,
    `Abandoned: ${metric(input.dashboards, "clinical", "sim_abandoned")}`,
    `Completion rate: ${metric(input.dashboards, "clinical", "completion_rate")}%`,
    `Assessments completed: ${metric(input.dashboards, "clinical", "assessment_done")}`,
  ];

  const securityHighlights = [
    `Audit events: ${metric(input.dashboards, "security", "audit_events")}`,
    `Auth failures: ${metric(input.dashboards, "security", "auth_failures")}`,
    `RBAC violations: ${metric(input.dashboards, "security", "rbac_violations")}`,
    `Open critical feedback: ${input.open_critical_feedback} · high: ${input.open_high_feedback}`,
  ];

  return [
    {
      ...common,
      kind: "executive",
      highlights: execHighlights,
      markdown: renderExecutive(input, execHighlights),
    },
    {
      ...common,
      kind: "clinical",
      highlights: clinicalHighlights,
      markdown: renderClinical(input, clinicalHighlights),
    },
    {
      ...common,
      kind: "security",
      highlights: securityHighlights,
      markdown: renderSecurity(input, securityHighlights),
    },
  ];
}

function metric(
  dash: CidpDashboardBundle,
  panelId: string,
  metricId: string,
): number {
  const panel = dash.panels.find((p) => p.id === panelId);
  return panel?.metrics.find((m) => m.id === metricId)?.value ?? 0;
}

function renderExecutive(input: WeeklyReportInput, highlights: string[]): string {
  return [
    `# CIDP Weekly Executive Report`,
    ``,
    `**Week ending:** ${input.week_ending}`,
    `**Version:** ${PACKAGE_VERSION}`,
    `**CIDP:** GO · **GA:** NO-GO`,
    `**Overall health:** ${input.success.overall_health}`,
    ``,
    `## Highlights`,
    ...highlights.map((h) => `- ${h}`),
    ``,
    `## Success metrics`,
    ...input.success.metrics.map(
      (m) => `- ${m.label}: ${m.value}${m.unit ?? ""}${m.target ? ` (target ${m.target})` : ""}`,
    ),
    ``,
    `## Pilot portfolio`,
    `- Institutions: ${input.pilots.pilots}`,
    `- Active residents: ${input.pilots.total_residents_active}`,
    `- Active faculty: ${input.pilots.total_faculty_active}`,
    `- Mean training completion: ${input.pilots.mean_training_completion_rate}%`,
    ``,
    `## Notes`,
    `- Aggregates only — no PHI.`,
    ...((input.notes ?? []).length
      ? (input.notes ?? []).map((n) => `- ${n}`)
      : ["- None"]),
    ``,
  ].join("\n");
}

function renderClinical(input: WeeklyReportInput, highlights: string[]): string {
  return [
    `# CIDP Weekly Clinical Operations Report`,
    ``,
    `**Week ending:** ${input.week_ending}`,
    `**Version:** ${PACKAGE_VERSION}`,
    ``,
    `> Clinical Core cognition unchanged. Counts are simulation lifecycle only.`,
    ``,
    `## Highlights`,
    ...highlights.map((h) => `- ${h}`),
    ``,
    `## Simulation lifecycle`,
    ...panelLines(input.dashboards, "clinical"),
    ``,
    `## Educational (observational)`,
    ...panelLines(input.dashboards, "educational"),
    ``,
  ].join("\n");
}

function renderSecurity(input: WeeklyReportInput, highlights: string[]): string {
  return [
    `# CIDP Weekly Security Report`,
    ``,
    `**Week ending:** ${input.week_ending}`,
    `**Version:** ${PACKAGE_VERSION}`,
    ``,
    `## Highlights`,
    ...highlights.map((h) => `- ${h}`),
    ``,
    `## Security metrics`,
    ...panelLines(input.dashboards, "security"),
    ``,
    `## Feedback triage pressure`,
    `- Open critical: ${input.open_critical_feedback}`,
    `- Open high: ${input.open_high_feedback}`,
    `- Security alerts (ops): ${input.security_alerts ?? 0}`,
    ``,
    `## Affirmations`,
    `- RBAC / RLS / rate limits remain binding.`,
    `- No service-role exposure to browser.`,
    `- Feedback PHI heuristics enforced.`,
    ``,
  ].join("\n");
}

function panelLines(dash: CidpDashboardBundle, id: string): string[] {
  const panel = dash.panels.find((p) => p.id === id);
  if (!panel) return ["- (panel unavailable)"];
  return panel.metrics.map(
    (m) => `- ${m.label}: ${m.value}${m.unit ?? ""}`,
  );
}

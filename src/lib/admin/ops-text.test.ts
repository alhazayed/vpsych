import { describe, expect, it } from "vitest";
import { buildCidpDashboards } from "@/lib/ops/cidp-dashboards";
import { buildCidpSuccessMetrics } from "@/lib/ops/cidp-success-metrics";
import { buildPhase14Readiness } from "@/lib/ops/phase14-readiness";
import { buildPhase15Readiness } from "@/lib/ops/phase15-readiness";
import { buildPhase16Execution } from "@/lib/ops/phase16-execution";
import { evaluatePhase16GaGates } from "@/lib/ops/phase16-ga-gates";
import { buildAnalyticsDashboard } from "@/lib/enterprise/analytics";
import { HIERARCHY_LABELS } from "@/lib/enterprise/organization";
import { ENTERPRISE_OWNERSHIP_RULE } from "@/lib/enterprise/versions";
import { SUPERVISOR_OWNERSHIP_RULE } from "@/lib/supervisor";
import { localizeOpsText, OPS_TEXT } from "./ops-text";

const translated = Object.assign(() => "\u00a7", { has: () => true });

/** Every label the admin ops pages render must have a translation key. */
function expectKnown(texts: Array<string | null | undefined>) {
  const missing = texts.filter(
    (text): text is string =>
      Boolean(text) && localizeOpsText(translated, text) === text,
  );
  expect(missing).toEqual([]);
}

describe("ops-text", () => {
  it("has one key per English text", () => {
    const values = Object.values(OPS_TEXT);
    expect(new Set(values).size).toBe(values.length);
  });

  it("translates known text and passes unknown text through", () => {
    const t = Object.assign((key: string) => `ar:${key}`, {
      has: (key: string) => key in OPS_TEXT || key === "detailCriticalOpen",
    });
    expect(localizeOpsText(t, "Deployment success rate")).toBe(
      "ar:deploymentSuccessRate",
    );
    expect(localizeOpsText(t, "Not a server string")).toBe(
      "Not a server string",
    );
    expect(localizeOpsText(t, "3 critical item(s) open")).toBe(
      "ar:detailCriticalOpen",
    );
    expect(localizeOpsText(t, null)).toBe("");
  });

  it("covers the CIDP dashboard and success-metric labels", () => {
    const d = buildCidpDashboards();
    const s = buildCidpSuccessMetrics();
    expectKnown([
      d.phi_policy,
      ...d.panels.flatMap((p) => [
        p.title,
        ...p.metrics.flatMap((m) => [m.label, m.note]),
      ]),
      ...d.executive.flatMap((m) => [m.label, m.note]),
      ...s.metrics.map((m) => m.label),
    ]);
  });

  it("covers the Phase 14 readiness surface", () => {
    const p = buildPhase14Readiness();
    expectKnown([
      p.ownership,
      p.ga.recommendation,
      ...p.ga.gates.map((g) => g.label),
      ...p.risks.unresolved.flatMap((r) => [r.description, r.owner]),
      ...p.lessons.items.map((l) => l.title),
      ...[p.clinical_evidence, p.educational_evidence, p.research_evidence]
        .flatMap((b) => b.metrics)
        .flatMap((m) => [m.label, m.note]),
      ...p.trends.series.map((s) => s.label),
    ]);
    const allPass = buildPhase14Readiness({
      gates: {
        production_infrastructure_verified: "PASS",
        security_residuals_closed: "PASS",
        stable_pilot_metrics: "PASS",
        acceptable_educational_outcomes: "PASS",
        clinical_validation_completed: "PASS",
        executive_release_board_authorization: "PASS",
      },
      dr_drill_rows: 1,
      pitr_rows: 1,
      risks: [],
    });
    expectKnown([allPass.ga.recommendation, allPass.risks.executive_summary]);
    expectKnown([p.risks.executive_summary]);
  });

  it("covers the Phase 15 authorization surface", () => {
    const p = buildPhase15Readiness();
    expectKnown([
      p.ownership,
      p.board_recommendation,
      p.authorization.motion,
      ...p.authorization.board_gates.map((g) => g.label),
    ]);
  });

  it("covers the Phase 16 execution surface", () => {
    const p = buildPhase16Execution();
    expectKnown([
      p.ownership,
      p.fabrication_policy,
      p.board_recommendation,
      p.institutions.institutions_registered.label,
      ...p.institutions.aggregates.map((a) => a.label),
      ...p.ga.gates.flatMap((g) => [g.label, g.detail]),
      ...p.dashboards.dashboards.flatMap((d) => [
        d.title,
        ...d.metrics.map((m) => m.label),
      ]),
    ]);
    const observed = evaluatePhase16GaGates({
      dr_drill_rows: 1,
      pitr_rows: 1,
      pen_test_rows: 1,
      security_residuals_closed: true,
      pilot_objectives_achieved: true,
      open_critical_feedback: 0,
      open_critical_risks: 0,
      clinical_validation_complete: true,
      educational_validation_complete: true,
      research_validation_complete: true,
      release_board_approval_signed: true,
    });
    expectKnown([observed.decision, ...observed.gates.map((g) => g.detail)]);
    const blocked = evaluatePhase16GaGates({ open_critical_feedback: 2 });
    expectKnown(blocked.gates.map((g) => g.detail));
  });

  it("covers enterprise and supervisor statements", () => {
    const executive = buildAnalyticsDashboard({
      organization_id: "org",
      scope: "executive",
    });
    const research = buildAnalyticsDashboard({
      organization_id: "org",
      scope: "research",
    });
    expectKnown([
      ENTERPRISE_OWNERSHIP_RULE,
      SUPERVISOR_OWNERSHIP_RULE,
      ...HIERARCHY_LABELS,
      ...executive.kpis.map((k) => k.label),
      ...research.kpis.map((k) => k.label),
    ]);
  });
});

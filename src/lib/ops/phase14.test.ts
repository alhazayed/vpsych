import { describe, expect, it } from "vitest";
import { evaluateGaReadiness } from "@/lib/ops/phase14-ga-gates";
import {
  defaultPhase14RiskRegister,
  isCriticalRisk,
  summarizeRiskRegister,
} from "@/lib/ops/phase14-risk-register";
import {
  defaultPhase14Lessons,
  summarizeLessons,
} from "@/lib/ops/phase14-lessons";
import {
  buildClinicalEvidence,
  buildEducationalEvidence,
  buildResearchEvidence,
} from "@/lib/ops/phase14-evidence";
import { buildSuccessTrends } from "@/lib/ops/phase14-trends";
import { buildPhase14Readiness } from "@/lib/ops/phase14-readiness";
import { buildWeeklyReports } from "@/lib/ops/cidp-weekly-reports";
import { buildCidpDashboards } from "@/lib/ops/cidp-dashboards";
import { buildCidpSuccessMetrics } from "@/lib/ops/cidp-success-metrics";
import { emptyPilotPortfolio } from "@/lib/ops/cidp-pilot";

describe("Phase 14 GA gates", () => {
  it("defaults to CIDP GO and GA NO-GO", () => {
    const eval_ = evaluateGaReadiness();
    expect(eval_.cidp_status).toBe("GO");
    expect(eval_.ga_status).toBe("NO-GO");
    expect(eval_.gates).toHaveLength(10);
    expect(eval_.open_count).toBeGreaterThan(0);
  });

  it("reaches GA GO only when every gate PASS", () => {
    const allPass = Object.fromEntries(
      evaluateGaReadiness().gates.map((g) => [g.id, "PASS" as const]),
    );
    const eval_ = evaluateGaReadiness({
      ...allPass,
      open_critical_feedback: 0,
      open_critical_risks: 0,
      dr_drill_rows: 1,
      pitr_rows: 1,
    });
    expect(eval_.ga_status).toBe("GO");
    expect(eval_.pass_count).toBe(10);
  });

  it("blocks GA when critical feedback remains", () => {
    const eval_ = evaluateGaReadiness({
      open_critical_feedback: 2,
      open_critical_risks: 0,
    });
    const gate = eval_.gates.find(
      (g) => g.id === "no_unresolved_critical_findings",
    );
    expect(gate?.status).toBe("OPEN");
    expect(eval_.ga_status).toBe("NO-GO");
  });
});

describe("Phase 14 risk register", () => {
  it("seeds residuals and summarizes critical-open", () => {
    const risks = defaultPhase14RiskRegister();
    expect(risks.length).toBeGreaterThanOrEqual(5);
    const summary = summarizeRiskRegister(risks);
    expect(summary.open).toBeGreaterThan(0);
    expect(summary.executive_summary).toMatch(/CIDP|GA|risk/i);
    expect(JSON.stringify(summary)).not.toMatch(/mrn|ssn|phi/i);
    expect(risks.some(isCriticalRisk)).toBe(true);
  });
});

describe("Phase 14 lessons and evidence", () => {
  it("summarizes lessons without PHI", () => {
    const summary = summarizeLessons(defaultPhase14Lessons());
    expect(summary.total).toBeGreaterThan(0);
    expect(summary.by_category.governance).toBeGreaterThan(0);
  });

  it("builds clinical/educational/research evidence aggregates", () => {
    const clinical = buildClinicalEvidence({
      simulations_started: 100,
      simulations_completed: 70,
      simulations_abandoned: 30,
      clinical_realism_mean: 0.8,
    });
    expect(clinical.metrics.find((m) => m.id === "completion_rate")?.value).toBe(
      70,
    );
    expect(clinical.phi_policy).toMatch(/PHI-free/);
    expect(buildEducationalEvidence().domain).toBe("educational");
    expect(buildResearchEvidence({ multicenter_sites: 3 }).metrics[1]?.value).toBe(
      3,
    );
  });

  it("computes trend directions", () => {
    const trends = buildSuccessTrends([
      { t: "2026-08-01", session_completion: 60, critical_incident_rate: 5 },
      { t: "2026-08-08", session_completion: 75, critical_incident_rate: 2 },
    ]);
    const completion = trends.series.find((s) => s.id === "session_completion");
    const incidents = trends.series.find(
      (s) => s.id === "critical_incident_rate",
    );
    expect(completion?.direction).toBe("up");
    expect(incidents?.direction).toBe("up"); // invert: lower is healthier → direction up
  });
});

describe("Phase 14 readiness package", () => {
  it("composes package and keeps GA NO-GO with seed risks", () => {
    const pack = buildPhase14Readiness({
      clinical: {
        simulations_started: 50,
        simulations_completed: 40,
        simulations_abandoned: 10,
      },
    });
    expect(pack.cert_id).toMatch(/PHASE14/);
    expect(pack.cidp_status).toBe("GO");
    expect(pack.ga_status).toBe("NO-GO");
    expect(pack.ownership).toMatch(/Never writes Clinical Core/);
    expect(pack.deliverables.length).toBeGreaterThan(5);
    expect(JSON.stringify(pack)).not.toMatch(/clinical_snapshot/);
  });
});

describe("Phase 14 weekly report kinds", () => {
  it("emits research, educational, and operations weekly reports", () => {
    const dashboards = buildCidpDashboards({
      simulations_started: 10,
      simulations_completed: 8,
    });
    const success = buildCidpSuccessMetrics({
      simulations_started: 10,
      simulations_completed: 8,
    });
    const reports = buildWeeklyReports({
      week_ending: "2026-08-07",
      dashboards,
      success,
      pilots: emptyPilotPortfolio(),
      open_critical_feedback: 0,
      open_high_feedback: 0,
      open_critical_risks: 1,
    });
    expect(reports.map((r) => r.kind)).toEqual([
      "executive",
      "clinical",
      "security",
      "research",
      "educational",
      "operations",
    ]);
    for (const r of reports) {
      expect(r.ga_status).toBe("NO-GO");
      expect(r.markdown).not.toMatch(/clinical_snapshot/);
    }
  });
});

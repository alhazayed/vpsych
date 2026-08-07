import { describe, expect, it } from "vitest";
import { buildCidpDashboards } from "@/lib/ops/cidp-dashboards";
import { buildCidpSuccessMetrics } from "@/lib/ops/cidp-success-metrics";
import {
  emptyPilotPortfolio,
  summarizePilotPortfolio,
  type PilotInstitution,
} from "@/lib/ops/cidp-pilot";
import { buildWeeklyReports } from "@/lib/ops/cidp-weekly-reports";

describe("CIDP execution engines", () => {
  it("summarizes pilot portfolio without PHI", () => {
    const pilots: PilotInstitution[] = [
      {
        id: "p1",
        institution_name: "State Med",
        institution_type: "university",
        status: "active",
        start_date: "2026-08-01",
        residents_invited: 20,
        residents_active: 12,
        faculty_active: 4,
        simulations_completed: 40,
        support_requests: 2,
        critical_incidents: 0,
        configuration_issues: 1,
        research_participating: true,
        training_completion_rate: 0.6,
      },
      {
        id: "p2",
        institution_name: "City Hospital",
        institution_type: "teaching_hospital",
        status: "planned",
        start_date: "2026-09-01",
        residents_invited: 10,
        residents_active: 0,
        faculty_active: 1,
        simulations_completed: 0,
        support_requests: 0,
        critical_incidents: 0,
        configuration_issues: 0,
        research_participating: false,
        training_completion_rate: 0,
      },
    ];
    const summary = summarizePilotPortfolio(pilots);
    expect(summary.pilots).toBe(2);
    expect(summary.deployment_success_rate).toBe(50);
    expect(summary.research_participating_orgs).toBe(1);
    expect(JSON.stringify(summary)).not.toMatch(/mrn|ssn|patient name/i);
  });

  it("builds success metrics and weekly reports", () => {
    const dashboards = buildCidpDashboards({
      simulations_started: 100,
      simulations_completed: 80,
      simulations_abandoned: 20,
      uptime_ratio: 1,
      api_latency_p95_ms: 200,
      error_rate: 0.01,
    });
    const success = buildCidpSuccessMetrics({
      pilots_total: 2,
      pilots_deployed_ok: 2,
      uptime_ratio: 1,
      api_latency_p95_ms: 200,
      simulations_started: 100,
      simulations_completed: 80,
      error_rate: 0.01,
    });
    expect(success.overall_health).toBe("green");
    const reports = buildWeeklyReports({
      week_ending: "2026-08-07",
      dashboards,
      success,
      pilots: emptyPilotPortfolio(),
      open_critical_feedback: 0,
      open_high_feedback: 1,
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
      expect(r.cidp_status).toBe("GO");
      expect(r.markdown).toMatch(/CIDP Weekly/);
      expect(r.markdown).not.toMatch(/clinical_snapshot/);
    }
  });
});

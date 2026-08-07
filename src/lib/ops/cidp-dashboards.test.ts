import { describe, expect, it } from "vitest";
import { buildCidpDashboards, CIDP_CERT_ID } from "@/lib/ops/cidp-dashboards";
import { PACKAGE_VERSION } from "@/lib/ops/versions";

describe("CIDP dashboards", () => {
  it("builds all required panels without PHI fields", () => {
    const dash = buildCidpDashboards({
      simulations_completed: 80,
      simulations_abandoned: 20,
      dau: 12,
      wau: 40,
      api_latency_p95_ms: 240,
      auth_failures: 2,
      institutions: 3,
      datasets: 1,
    });
    expect(dash.cert_id).toBe(CIDP_CERT_ID);
    expect(dash.package_version).toBe(PACKAGE_VERSION);
    expect(dash.panels.map((p) => p.id)).toEqual([
      "system",
      "clinical",
      "institution",
      "research",
      "security",
    ]);
    const completion = dash.executive.find((m) => m.id === "completion_rate");
    expect(completion?.value).toBe(80);
    expect(dash.phi_policy).toMatch(/No patient-identifiable/);
    expect(JSON.stringify(dash)).not.toMatch(/session_reports|narrative|transcript/i);
  });
});

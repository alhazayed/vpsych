import { describe, expect, it, beforeEach } from "vitest";
import { validateProductionEnv } from "@/lib/env";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import {
  buildGaDashboards,
  buildProductionOpsSnapshot,
  clearTelemetryForTests,
  PACKAGE_VERSION,
  runOperationalValidation,
  simulateSessionLoad,
  STAGE12_CERT_ID,
} from "@/lib/ops";

describe("Stage 12 ops helpers", () => {
  beforeEach(() => clearTelemetryForTests());

  it("validateProductionEnv never returns secret values", () => {
    const result = validateProductionEnv();
    expect(result.checks.length).toBeGreaterThan(3);
    for (const c of result.checks) {
      expect(c).toHaveProperty("present");
      expect(c).toHaveProperty("key");
      expect(JSON.stringify(c)).not.toMatch(/sk_/);
    }
  });

  it("mints or accepts request ids", () => {
    const minted = resolveRequestId(new Request("https://vpsych.test/api"));
    expect(minted.length).toBeGreaterThan(8);
    const echoed = resolveRequestId(
      new Request("https://vpsych.test/api", {
        headers: { "x-request-id": "a1b2c3d4-e5f6-4789-a012-3456789abcde" },
      }),
    );
    expect(echoed).toBe("a1b2c3d4-e5f6-4789-a012-3456789abcde");
    expect(requestIdHeaders(echoed)["X-Request-Id"]).toBe(echoed);
  });

  it("rejects malformed request ids", () => {
    const bad = resolveRequestId(
      new Request("https://vpsych.test/api", {
        headers: { "x-request-id": "no spaces allowed here!!!" },
      }),
    );
    expect(bad).not.toBe("no spaces allowed here!!!");
  });

  it("builds a production ops snapshot without throwing", () => {
    const snap = buildProductionOpsSnapshot();
    expect(snap.cert_id).toBe(STAGE12_CERT_ID);
    expect(snap.package_version).toBe(PACKAGE_VERSION);
    expect(snap.health.liveness).toBe("ok");
    expect(snap.clinical_pipeline.stages).toContain("assess");
    expect(snap.latency_budgets.elevenlabs_timeout_ms).toBeGreaterThan(0);
  });

  it("simulates 100 and 1000 session loads for GA methodology", () => {
    const s100 = simulateSessionLoad(100);
    expect(s100.session_starts).toBe(100);
    clearTelemetryForTests();
    const s1000 = simulateSessionLoad(1000);
    expect(s1000.session_starts).toBe(1000);
    expect(s1000.completion_rate).toBeGreaterThan(0.9);
  });

  it("builds GA dashboards and runs operational validation", () => {
    const boards = buildGaDashboards();
    expect(Object.keys(boards.dashboards)).toContain("platform_health");
    expect(Object.keys(boards.dashboards)).toContain("security");
    // Docs must exist for PASS — created in same PR; validation may WARN on DR/pilot
    const result = runOperationalValidation({ simulateSessions: 100 });
    expect(result.fail).toBe(0);
    expect(["GO", "NO-GO"]).toContain(result.recommendation);
  });
});

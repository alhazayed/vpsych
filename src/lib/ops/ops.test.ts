import { describe, expect, it } from "vitest";
import { validateProductionEnv } from "@/lib/env";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import { buildProductionOpsSnapshot, PACKAGE_VERSION, STAGE12_CERT_ID } from "@/lib/ops";

describe("Stage 12 ops helpers", () => {
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
});

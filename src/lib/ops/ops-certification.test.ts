import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { runAllOutageSimulations } from "./outage-sim";
import { buildReadinessReport, httpStatusForReadiness } from "./readiness";
import { assessOperationalReadiness } from "./assessment";
import {
  createIncidentStub,
  RECOVERY_OBJECTIVES,
  severityForDependency,
} from "./targets";
import { openaiCircuit, elevenLabsCircuit } from "@/lib/performance/resilience";

describe("Mission 24 — Disaster Recovery & Operational Excellence", () => {
  it("defines RTO/RPO objectives", () => {
    expect(RECOVERY_OBJECTIVES.rtoHours).toBe(4);
    expect(RECOVERY_OBJECTIVES.rpoHours).toBe(24);
  });

  it("builds readiness without network when skipped", async () => {
    openaiCircuit.reset();
    elevenLabsCircuit.reset();
    const report = await buildReadinessReport({ probeNetwork: false });
    expect(report.checks.some((c) => c.id === "app")).toBe(true);
    expect(report.circuits.openai).toBe("closed");
    expect(["ok", "degraded", "down"]).toContain(report.status);
    expect(httpStatusForReadiness("down")).toBe(503);
    expect(httpStatusForReadiness("degraded")).toBe(200);
  });

  it("simulates OpenAI, ElevenLabs, Supabase, network, DB, and rollback", async () => {
    const { results, allPassed, rtoBudgetHours, rpoBudgetHours } =
      await runAllOutageSimulations();
    expect(results).toHaveLength(6);
    expect(allPassed).toBe(true);
    expect(rtoBudgetHours).toBe(4);
    expect(rpoBudgetHours).toBe(24);
    for (const r of results) {
      expect(r.recovered).toBe(true);
      expect(r.alertGenerated).toBe(true);
      expect(r.ok).toBe(true);
    }

    const outDir = "/opt/cursor/artifacts/ops-cert";
    try {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(
        join(outDir, "outage-simulations.json"),
        JSON.stringify(
          { generatedAt: new Date().toISOString(), results },
          null,
          2,
        ),
      );
    } catch {
      /* optional */
    }
  });

  it("creates incident stubs with severity and checklist", () => {
    expect(severityForDependency("supabase", true)).toBe("SEV1");
    expect(severityForDependency("openai", true)).toBe("SEV2");
    const inc = createIncidentStub({
      severity: "SEV1",
      title: "db down",
      dependency: "database",
    });
    expect(inc.checklist.length).toBeGreaterThan(5);
    expect(inc.status).toBe("open");
  });

  it("scores operational readiness with recommendations path", () => {
    const a = assessOperationalReadiness({
      publicHealth: true,
      readinessEndpoint: true,
      circuitBreakers: true,
      outageHarness: true,
      drRunbook: true,
      incidentRunbook: true,
      upstashConfigured: false,
      previewProtection: false,
      sentryConfigured: false,
    });
    expect(a.score).toBeGreaterThanOrEqual(70);
    expect(a.verdict).toBe(
      "OPERATIONALLY_CERTIFIED_WITH_RECOMMENDATIONS",
    );
  });

  it("exposes health routes and DR docs", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "src/app/api/health/route.ts"))).toBe(true);
    expect(existsSync(join(root, "src/app/api/health/ready/route.ts"))).toBe(
      true,
    );
    expect(existsSync(join(root, "docs/DISASTER_RECOVERY.md"))).toBe(true);
    expect(existsSync(join(root, "docs/OPS_RUNBOOK.md"))).toBe(true);
    expect(existsSync(join(root, "docs/INCIDENT_RESPONSE.md"))).toBe(true);
    const mw = readFileSync(
      join(root, "src/lib/supabase/middleware.ts"),
      "utf8",
    );
    expect(mw).toMatch(/\/api\/health/);
  });
});

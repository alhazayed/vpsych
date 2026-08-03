import { describe, expect, it } from "vitest";
import { ENTERPRISE_SCENARIOS, runLoadScenario } from "./load-sim";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

describe("enterprise load simulation", () => {
  it(
    "runs 100 → 10k concurrent learner scenarios with protective shedding",
    async () => {
      const results = [];
      for (const scenario of ENTERPRISE_SCENARIOS) {
        const result = await runLoadScenario(scenario);
        results.push(result);
        expect(result.recoveryOk).toBe(true);
        expect(result.certified).toBe(true);
      }

      const outDir = "/opt/cursor/artifacts/performance-cert";
      try {
        mkdirSync(outDir, { recursive: true });
        writeFileSync(
          join(outDir, "load-sim-results.json"),
          JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
        );
      } catch {
        /* artifacts dir may be unavailable in some CI */
      }

      // Extreme scales must shed via rate-limit, circuit, or backpressure.
      const extreme = results.filter((r) => r.concurrentLearners >= 5000);
      for (const r of extreme) {
        const shed =
          r.rejectedBackpressure + r.rejectedCircuit + r.rejectedRateLimit;
        expect(shed).toBeGreaterThan(0);
      }
    },
    120_000,
  );
});

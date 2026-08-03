/**
 * CLI-friendly runner: node via vitest inline would be heavy; export for tests.
 * Artifact writer used by certification test suite.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { runEducationalOutcomesCertification } from "./simulate";

export function writeEducationalOutcomesArtifact(path: string): void {
  const report = runEducationalOutcomesCertification(50);
  // Strip full learning curves to keep artifact readable (keep first/last + slope)
  const compact = {
    ...report,
    journeys: report.journeys.map((j) => ({
      ...j,
      tiers: j.tiers.map((t) => ({
        ...t,
        growth: {
          ...t.growth,
          learning_curve_len: t.growth.learning_curve.length,
          learning_curve_head: t.growth.learning_curve.slice(0, 5),
          learning_curve_tail: t.growth.learning_curve.slice(-5),
          learning_curve: undefined,
        },
      })),
    })),
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(compact, null, 2));
}

/**
 * `npm run test:reliability` entry point.
 *
 * Runs the reliability harness end-to-end against the SYNTHETIC calibration
 * corpus and asserts that it is reproducible and self-describing.
 *
 * It deliberately does NOT touch the production corpus. Running against real
 * learner data is Program F2 and requires OD-21 (psychometric authority) and
 * OD-25 (corpus analysis authorization). Neither exists, so this harness is
 * verified on synthetic data only.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  computeReliabilityReport,
  subjectsFromStoredReports,
  withCompleteProvenance,
  type StoredReportLike,
} from "@/lib/assessment-reliability";

type Fixture = {
  _meta: { n_subjects: number; warning: string };
  reports: StoredReportLike[];
};

function loadFixture(): Fixture {
  const path = join(process.cwd(), "calibration", "synthetic-corpus.json");
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

describe("reliability harness — synthetic calibration run", () => {
  const fixture = loadFixture();
  const subjects = subjectsFromStoredReports(fixture.reports);

  it("loads the synthetic corpus and every row is usable", () => {
    expect(fixture.reports.length).toBe(fixture._meta.n_subjects);
    expect(subjects.length).toBe(fixture.reports.length);
    expect(withCompleteProvenance(subjects).length).toBe(subjects.length);
  });

  it("produces a non-blocking, configuration-homogeneous report", () => {
    const report = computeReliabilityReport(subjects);
    expect(report.blocking).toEqual([]);
    expect(report.provenance.configuration_homogeneous).toBe(true);
    expect(report.dimensions).toHaveLength(11);
    expect(report.cronbach_alpha).not.toBeNull();
  });

  it("is reproducible — identical input yields identical statistics", () => {
    const at = () => new Date("2026-01-01T00:00:00Z");
    const first = computeReliabilityReport(subjects, at);
    const second = computeReliabilityReport(
      subjectsFromStoredReports(loadFixture().reports),
      at,
    );
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("recovers the deliberately noisy dimension as the weakest item", () => {
    const report = computeReliabilityReport(subjects);
    const weakest = [...report.items].sort(
      (a, b) => (a.corrected_item_total_r ?? 1) - (b.corrected_item_total_r ?? 1),
    )[0]!;
    // The fixture builds `structure` with a much lower loading on latent ability.
    expect(weakest.id).toBe("structure");
    // And dropping it should improve internal consistency.
    expect(weakest.alpha_if_dropped!).toBeGreaterThan(report.cronbach_alpha!);
  });

  it("carries its limitations with the number, always", () => {
    const report = computeReliabilityReport(subjects);
    expect(report.limitations.length).toBeGreaterThan(0);
    // Reported statistics must never travel without the caveats that bound them.
    const joined = report.limitations.join(" ");
    expect(joined).toMatch(/non-deterministic/i);
    expect(joined).toMatch(/SIMULATED/);
  });

  it("prints the calibration report for the run log", () => {
    const report = computeReliabilityReport(subjects);
    const lines = [
      "",
      "  VPsych assessment reliability — SYNTHETIC calibration run",
      "  ---------------------------------------------------------",
      `  harness            ${report.harness_version}`,
      `  subjects           ${report.n_subjects}`,
      `  dimensions         ${report.dimensions.length}`,
      `  model(s)           ${report.provenance.distinct_models.join(", ") || "(none recorded)"}`,
      `  prompt version(s)  ${report.provenance.distinct_prompt_versions.join(", ") || "(none recorded)"}`,
      `  homogeneous        ${report.provenance.configuration_homogeneous}`,
      `  cronbach alpha     ${report.cronbach_alpha}`,
      `  overall mean (sd)  ${report.overall_mean} (${report.overall_sd})`,
      "",
      "  item                      mean     sd   corrected r   alpha-if-dropped",
    ];
    for (const item of report.items) {
      lines.push(
        `  ${item.id.padEnd(24)}${String(item.mean).padStart(5)}  ${String(item.sd).padStart(5)}   ${String(
          item.corrected_item_total_r,
        ).padStart(11)}   ${String(item.alpha_if_dropped).padStart(16)}`,
      );
    }
    lines.push("");
    lines.push("  LIMITATIONS");
    for (const limitation of report.limitations) lines.push(`   - ${limitation}`);
    lines.push("");
    lines.push("  SYNTHETIC DATA — this run is not evidence about the instrument.");
    lines.push("");
    console.log(lines.join("\n"));
    expect(report.n_subjects).toBeGreaterThan(0);
  });
});

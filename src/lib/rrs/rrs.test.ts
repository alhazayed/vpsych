/**
 * Research Readiness Score (RRS) v1.0 — unit & integration suite.
 */
import { describe, expect, it } from "vitest";
import {
  RRS_VERSION,
  RRS_WEIGHT_MATRIX,
  assertWeightMatrixValid,
  buildRrsDashboard,
  buildRrsOfflineCorpus,
  computeResearchReadinessScore,
  rrsInputFromPlatform,
  type RrsDimensionId,
} from "@/lib/rrs";

describe("RRS weight matrix", () => {
  it("sums to 1.0 with unique dimension ids", () => {
    expect(() => assertWeightMatrixValid()).not.toThrow();
    const sum = RRS_WEIGHT_MATRIX.reduce((a, e) => a + e.weight, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
    expect(RRS_WEIGHT_MATRIX).toHaveLength(17);
    expect(RRS_VERSION).toBe("1.0.0");
  });

  it("covers all required research dimensions", () => {
    const ids = new Set(RRS_WEIGHT_MATRIX.map((e) => e.id));
    const required: RrsDimensionId[] = [
      "version_control",
      "data_completeness",
      "data_integrity",
      "auditability",
      "reproducibility",
      "assessment_reproducibility",
      "prompt_versioning",
      "persona_versioning",
      "clinical_template_versioning",
      "ai_model_versioning",
      "dataset_consistency",
      "longitudinal_consistency",
      "export_quality",
      "metadata_completeness",
      "anonymization_readiness",
      "gdpr_compliance",
      "institutional_research_readiness",
    ];
    for (const id of required) expect(ids.has(id)).toBe(true);
  });
});

describe("computeResearchReadinessScore", () => {
  it("returns overall, reports, version and reproducibility matrices", () => {
    const input = rrsInputFromPlatform({
      dataset_id: "test-platform",
      model_version: "gpt-test",
    });
    const rrs = computeResearchReadinessScore(input);

    expect(rrs.overall).toBeGreaterThanOrEqual(0);
    expect(rrs.overall).toBeLessThanOrEqual(100);
    expect(rrs.subscores).toHaveLength(17);
    expect(rrs.confidence_interval.level).toBe(0.95);
    expect(rrs.publication_readiness_report.length).toBeGreaterThan(40);
    expect(rrs.dataset_quality_report.length).toBeGreaterThan(20);
    expect(rrs.version_matrix.length).toBeGreaterThanOrEqual(6);
    expect(rrs.reproducibility_matrix.length).toBeGreaterThanOrEqual(3);
    expect(rrs.versions.rrs_version).toBe(RRS_VERSION);
    expect(rrs.versions.dataset_version).toBeTruthy();
    expect(rrs.versions.schema_version).toBeTruthy();
    expect(rrs.versions.prompt_version).toBeTruthy();
    expect(rrs.versions.export_version).toBeTruthy();

    const weightedSum = rrs.subscores.reduce(
      (a, s) => a + s.score * s.weight,
      0,
    );
    expect(Math.abs(weightedSum - rrs.overall)).toBeLessThan(1.5);
  });

  it("does not invent full credit for missing research export / anonymization", () => {
    const rrs = computeResearchReadinessScore({
      ...rrsInputFromPlatform(),
      research_export_api_present: false,
      anonymization_pipeline_present: false,
      gdpr_dsar_productized: false,
      gdpr_documented: true,
    });
    const exportQ = rrs.subscores.find((s) => s.id === "export_quality")!;
    const anon = rrs.subscores.find((s) => s.id === "anonymization_readiness")!;
    const gdpr = rrs.subscores.find((s) => s.id === "gdpr_compliance")!;
    expect(exportQ.score).toBeLessThan(50);
    expect(anon.score).toBeLessThan(50);
    expect(gdpr.score).toBeLessThan(70);
    expect(rrs.recommendations.length).toBeGreaterThan(0);
  });
});

describe("buildRrsOfflineCorpus + dashboard", () => {
  it("builds platform / heuristic / target snapshots and aggregates", () => {
    const records = buildRrsOfflineCorpus();
    expect(records.length).toBe(3);
    expect(records.map((r) => r.dataset_id).sort()).toEqual([
      "vpsych-heuristic-degraded",
      "vpsych-platform",
      "vpsych-research-export-target",
    ]);

    const platform = records.find((r) => r.dataset_id === "vpsych-platform")!;
    const target = records.find(
      (r) => r.dataset_id === "vpsych-research-export-target",
    )!;
    expect(target.overall).toBeGreaterThanOrEqual(platform.overall);

    const dash = buildRrsDashboard(records);
    expect(dash.n).toBe(3);
    expect(dash.overall_mean).not.toBeNull();
    expect(dash.version_matrix.length).toBeGreaterThan(0);
    expect(dash.reproducibility_matrix.length).toBeGreaterThan(0);
    expect(dash.dataset_quality.mean_completeness).not.toBeNull();
    expect(dash.rrs_version).toBe(RRS_VERSION);
  });
});

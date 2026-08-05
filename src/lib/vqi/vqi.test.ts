/**
 * VPsych Quality Index (VQI) v1.0 — unit & integration suite.
 */
import { describe, expect, it } from "vitest";
import {
  VQI_VERSION,
  VQI_ALGORITHM_VERSION,
  assertWeightSetValid,
  buildVqiDashboard,
  buildVqiOfflineCorpus,
  classifyMaturity,
  computeVPsychQualityIndex,
  createDefaultWeightSet,
  createWeightSetVersion,
  detectQualityDrift,
  drainVqiRecalculationQueue,
  exportVqiCsv,
  exportVqiJson,
  freezeWeightSet,
  issueQualityCertificate,
  maturityLabel,
  requestVqiRecalculation,
  resolveEffectiveWeights,
  validateVqiScience,
} from "@/lib/vqi";

describe("VQI weight set", () => {
  it("default weights sum to 1.0 with mission ratios", () => {
    const set = createDefaultWeightSet();
    expect(() => assertWeightSetValid(set)).not.toThrow();
    expect(VQI_VERSION).toBe("1.0.0");
    expect(VQI_ALGORITHM_VERSION).toBe("1.0.0");
    const byId = Object.fromEntries(
      set.entries.map((e) => [e.metric_id, e.weight]),
    );
    expect(byId.CFI).toBe(0.3);
    expect(byId.ERI).toBe(0.25);
    expect(byId.AVI).toBe(0.2);
    expect(byId.ALE).toBe(0.15);
    expect(byId.RRS).toBe(0.1);
  });

  it("versions weight changes and freezes immutably", () => {
    const created = createWeightSetVersion({
      id: "test-weights",
      name: "Test",
      entries: [
        { metric_id: "CFI", weight: 0.4, rationale: "t" },
        { metric_id: "ERI", weight: 0.2, rationale: "t" },
        { metric_id: "AVI", weight: 0.2, rationale: "t" },
        { metric_id: "ALE", weight: 0.1, rationale: "t" },
        { metric_id: "RRS", weight: 0.1, rationale: "t" },
      ],
    });
    expect(created.version).not.toBe("1.0.0");
    expect(created.frozen).toBe(false);
    const frozen = freezeWeightSet(created.id, created.version);
    expect(frozen.frozen).toBe(true);
  });
});

describe("classifyMaturity", () => {
  it("maps bands per certification spec", () => {
    expect(classifyMaturity(59.9)).toBe("experimental");
    expect(classifyMaturity(60)).toBe("development");
    expect(classifyMaturity(74)).toBe("development");
    expect(classifyMaturity(75)).toBe("pilot_ready");
    expect(classifyMaturity(84)).toBe("pilot_ready");
    expect(classifyMaturity(85)).toBe("production_ready");
    expect(classifyMaturity(94)).toBe("production_ready");
    expect(classifyMaturity(95)).toBe("world_class");
    expect(maturityLabel("world_class")).toContain("World-Class");
  });
});

describe("computeVPsychQualityIndex", () => {
  it("computes weighted composite with provenance and CI", () => {
    const vqi = computeVPsychQualityIndex({
      entity_type: "assessment",
      entity_id: "a1",
      metrics: [
        { metric_id: "CFI", score: 90, confidence: 85, version: "1.0.0" },
        { metric_id: "ERI", score: 80, confidence: 80, version: "1.0.0" },
        { metric_id: "AVI", score: 70, confidence: 75, version: "1.0.0" },
        { metric_id: "ALE", score: 60, confidence: 70, version: "1.0.0" },
        { metric_id: "RRS", score: 50, confidence: 65, version: "1.0.0" },
      ],
      weight_set: createDefaultWeightSet(),
    });
    const expected = 90 * 0.3 + 80 * 0.25 + 70 * 0.2 + 60 * 0.15 + 50 * 0.1;
    expect(Math.abs(vqi.overall - expected)).toBeLessThan(0.6);
    expect(vqi.subscores).toHaveLength(5);
    expect(vqi.confidence_interval.level).toBe(0.95);
    expect(vqi.provenance.vqi_version).toBe(VQI_VERSION);
    expect(vqi.provenance.weight_version).toBeTruthy();
    expect(vqi.provenance.metric_versions.CFI).toBeTruthy();
    expect(vqi.scientific_interpretation.length).toBeGreaterThan(40);
  });

  it("renormalizes weights when optional metrics are missing", () => {
    const { effective, missing } = resolveEffectiveWeights(
      createDefaultWeightSet(),
      new Set(["CFI", "ERI", "AVI"]),
    );
    expect(missing).toEqual(expect.arrayContaining(["ALE", "RRS"]));
    const mass = [...effective.values()].reduce((a, b) => a + b, 0);
    expect(Math.abs(mass - 1)).toBeLessThan(1e-9);

    const vqi = computeVPsychQualityIndex({
      entity_type: "learner",
      entity_id: "l1",
      metrics: [
        { metric_id: "CFI", score: 80, confidence: 80 },
        { metric_id: "ERI", score: 80, confidence: 80 },
        { metric_id: "AVI", score: 80, confidence: 80 },
      ],
      weight_set: createDefaultWeightSet(),
    });
    expect(vqi.overall).toBeCloseTo(80, 0);
    expect(vqi.missing_metrics).toEqual(
      expect.arrayContaining(["ALE", "RRS"]),
    );
  });

  it("penalizes missing required metrics", () => {
    const full = computeVPsychQualityIndex({
      entity_type: "platform",
      entity_id: "p",
      metrics: [
        { metric_id: "CFI", score: 90 },
        { metric_id: "ERI", score: 90 },
        { metric_id: "AVI", score: 90 },
        { metric_id: "ALE", score: 90 },
        { metric_id: "RRS", score: 90 },
      ],
      weight_set: createDefaultWeightSet(),
    });
    const missingRequired = computeVPsychQualityIndex({
      entity_type: "platform",
      entity_id: "p",
      metrics: [
        { metric_id: "ALE", score: 90 },
        { metric_id: "RRS", score: 90 },
      ],
      weight_set: createDefaultWeightSet(),
    });
    expect(missingRequired.overall).toBeLessThan(full.overall);
    expect(missingRequired.missing_metrics).toEqual(
      expect.arrayContaining(["CFI", "ERI", "AVI"]),
    );
  });

  it("flags outlier vs prior", () => {
    const vqi = computeVPsychQualityIndex({
      entity_type: "assessment",
      entity_id: "a2",
      metrics: [
        { metric_id: "CFI", score: 90 },
        { metric_id: "ERI", score: 90 },
        { metric_id: "AVI", score: 90 },
        { metric_id: "ALE", score: 90 },
        { metric_id: "RRS", score: 90 },
      ],
      weight_set: createDefaultWeightSet(),
      prior_overall: 50,
    });
    expect(vqi.outlier).toBe(true);
  });
});

describe("certificate + science + corpus", () => {
  it("issues certificate with maturity and confidence domains", () => {
    const vqi = computeVPsychQualityIndex({
      entity_type: "platform",
      entity_id: "vpsych",
      metrics: [
        { metric_id: "CFI", score: 88 },
        { metric_id: "ERI", score: 86 },
        { metric_id: "AVI", score: 84 },
        { metric_id: "ALE", score: 82 },
        { metric_id: "RRS", score: 78 },
      ],
      weight_set: createDefaultWeightSet(),
    });
    const cert = issueQualityCertificate(vqi);
    expect(cert.certificate_id).toMatch(/^VQI-CERT-/);
    expect(cert.overall_vqi).toBe(vqi.overall);
    expect(cert.maturity).toBe(vqi.maturity);
    expect(cert.confidence.clinical).toBeGreaterThan(0);
    expect(cert.platform_readiness.length).toBeGreaterThan(10);
  });

  it("builds hierarchical offline corpus and dashboard", () => {
    const records = buildVqiOfflineCorpus();
    expect(records.length).toBeGreaterThan(5);
    expect(records.some((r) => r.entity_type === "platform")).toBe(true);
    expect(records.some((r) => r.entity_type === "disorder")).toBe(true);
    expect(records.some((r) => r.entity_type === "language")).toBe(true);

    const dash = buildVqiDashboard(records, createDefaultWeightSet());
    expect(dash.platform_vqi).toBeTruthy();
    expect(dash.certificate).toBeTruthy();
    expect(dash.radar.length).toBeGreaterThanOrEqual(5);
    expect(dash.distribution.reduce((a, b) => a + b.n, 0)).toBe(
      records.length,
    );

    const science = validateVqiScience(records);
    expect(science.n).toBe(records.length);
    expect(science.explainability).toBe("full");
    expect(science.repeatability_r).toBe(1);

    const csv = exportVqiCsv(records);
    expect(csv.split("\n").length).toBeGreaterThan(records.length);
    const json = JSON.parse(exportVqiJson(records)) as {
      format: string;
      n: number;
      records: unknown[];
    };
    expect(json.format).toBe("vpsych-vqi-export");
    expect(json.n).toBe(records.length);
    expect(json.records).toHaveLength(records.length);
  });
});

describe("trends + hooks", () => {
  it("detects quality drift", () => {
    const drift = detectQualityDrift([
      { at: "2026-01-01", period: "day", mean: 70, n: 1 },
      { at: "2026-01-02", period: "day", mean: 80, n: 1 },
    ]);
    expect(drift.drift).toBe("improving");
    expect(drift.delta).toBe(10);
  });

  it("queues recalculation triggers", () => {
    drainVqiRecalculationQueue();
    requestVqiRecalculation("assessment_completed", {
      entity_type: "assessment",
      entity_id: "x",
    });
    requestVqiRecalculation("weight_set_updated");
    const q = drainVqiRecalculationQueue();
    expect(q).toHaveLength(2);
    expect(q[0]!.trigger).toBe("assessment_completed");
    expect(drainVqiRecalculationQueue()).toHaveLength(0);
  });
});

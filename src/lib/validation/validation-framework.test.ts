/**
 * Stage 8 — Scientific Validation Platform tests.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildAuditReports,
  buildPublicationSupport,
  buildQualityMetrics,
  buildResearchDatasetPackage,
  buildValidationDashboard,
  clearValidationStoreForTests,
  cohenKappa,
  compareAgainstBenchmarks,
  computeInterRater,
  evaluateLongitudinal,
  evaluatePsychometrics,
  exportRunsCsv,
  icc1,
  LONGITUDINAL_HORIZONS,
  runValidationAfterAssessment,
  runValidationPipeline,
  scoreConsistency,
  scoreRealism,
  scoreReliability,
  simulateLongitudinalCorpus,
  storeExpertRating,
  listExpertRatings,
  validateScenarioDsm,
  VALIDATION_FORBIDDEN_WRITES,
  VALIDATION_OWNERSHIP_RULE,
  VALIDATION_VERSION,
} from "@/lib/validation";
import { detectImpossibleTimeline } from "@/lib/validation/scenario-validator";

beforeEach(() => {
  clearValidationStoreForTests();
});

describe("ownership invariants", () => {
  it("documents observational ownership", () => {
    expect(VALIDATION_OWNERSHIP_RULE).toMatch(/observes only/i);
    expect(VALIDATION_FORBIDDEN_WRITES).toContain("clinical_snapshot");
    expect(VALIDATION_FORBIDDEN_WRITES).toContain("case_memory");
    expect(VALIDATION_FORBIDDEN_WRITES).toContain("DecisionPlan");
  });

  it("barrel and bridge never claim patient ownership", () => {
    const bridge = readFileSync(
      join(process.cwd(), "src/lib/validation/session-bridge.ts"),
      "utf8",
    );
    expect(bridge).toMatch(/Never writes clinical_snapshot/);
    expect(bridge).not.toMatch(/\.from\(["']sessions["']\)\.update/);
    expect(bridge).not.toMatch(/\.from\(["']case_memory["']\)/);
    expect(bridge).not.toMatch(/saveAdaptationState|processEmotionTurn|decidePatientTurn/);
  });
});

describe("Realism + Consistency + DSM validators", () => {
  it("scores a simulated session observationally", () => {
    const sessions = simulateLongitudinalCorpus(3, "unit-realism");
    const session = sessions[0]!;
    const realism = scoreRealism(session);
    expect(realism.overall).toBeGreaterThan(0);
    expect(realism.overall).toBeLessThanOrEqual(100);
    expect(realism.dimensions.length).toBe(21);
    expect(realism.confidence_interval.level).toBe(0.95);

    const consistency = scoreConsistency(session);
    expect(consistency.overall).toBeGreaterThan(0);

    const dsm = validateScenarioDsm(session);
    expect(dsm.dimensions.some((d) => d.id === "dsm_coherence")).toBe(true);
    expect(
      dsm.dimensions
        .find((d) => d.id === "dsm_coherence")
        ?.notes.some((n) => /never assigns|Consistency only/i.test(n)),
    ).toBe(true);
  });

  it("flags impossible timelines without assigning diagnoses", () => {
    expect(detectImpossibleTimeline("pdd", "2 weeks")).toBe(true);
    expect(detectImpossibleTimeline("mdd", "months")).toBe(false);
  });
});

describe("Inter-rater Engine", () => {
  it("computes kappa, ICC, and agreement", () => {
    expect(cohenKappa([0, 1, 1, 0, 1], [0, 1, 0, 0, 1], 2)).not.toBeNull();
    expect(icc1([[1, 1.1], [2, 2.2], [3, 2.8], [4, 4.1], [5, 4.9]])).not.toBeNull();

    for (let i = 0; i < 6; i++) {
      storeExpertRating({
        id: `a-${i}`,
        rater_id: "r1",
        session_id: null,
        case_key: `c${i}`,
        domain: "overall_realism",
        score: 70 + i,
        scale_max: 100,
        notes: null,
        rated_at: new Date().toISOString(),
        study_id: "t",
      });
      storeExpertRating({
        id: `b-${i}`,
        rater_id: "r2",
        session_id: null,
        case_key: `c${i}`,
        domain: "overall_realism",
        score: 72 + i,
        scale_max: 100,
        notes: null,
        rated_at: new Date().toISOString(),
        study_id: "t",
      });
    }

    const result = computeInterRater(listExpertRatings(), "overall_realism");
    expect(result.n_raters).toBe(2);
    expect(result.n_cases).toBeGreaterThanOrEqual(5);
    expect(result.sufficient_for_inference).toBe(true);
    expect(result.cohen_kappa).not.toBeNull();
  });
});

describe("Validation pipeline integration", () => {
  it("produces full run with six audit reports", async () => {
    const sessions = simulateLongitudinalCorpus(10, "pipeline");
    const run = runValidationPipeline({
      session: sessions[0]!,
      sessionsForPsychometrics: sessions,
      persist: true,
    });
    expect(run.observational).toBe(true);
    expect(run.patient_state_modified).toBe(false);
    expect(run.audits.map((a) => a.kind).sort()).toEqual(
      ["clinical", "consistency", "decision", "realism", "risk", "validation"].sort(),
    );
    expect(run.longitudinal.map((h) => h.horizon)).toEqual([...LONGITUDINAL_HORIZONS]);
    expect(run.psychometrics.every((p) => p.significance_claimed === false)).toBe(
      true,
    );
    expect(run.versions.validation_version).toBe(VALIDATION_VERSION);

    const bridge = await runValidationAfterAssessment({
      sessionId: "bridge-session",
      overall: 72,
      items: [
        { id: "a", score: 4, max: 5 },
        { id: "b", score: 3, max: 5 },
      ],
      messages: [
        { role: "user", content: "How are you feeling?" },
        { role: "assistant", content: "I feel anxious but I hope things improve." },
      ],
    });
    expect(bridge.ok).toBe(true);
    expect(bridge.run?.patient_state_modified).toBe(false);
  });

  it("builds metrics, benchmarks, publication, and research export", () => {
    const sessions = simulateLongitudinalCorpus(8, "export");
    const run = runValidationPipeline({
      session: sessions[0]!,
      sessionsForPsychometrics: sessions,
    });
    const metrics = buildQualityMetrics({
      realismOverall: run.realism.overall,
      consistencyOverall: run.consistency.overall,
      dsmOverall: run.dsm.overall,
      realismDimensions: run.realism.dimensions,
      sessions,
    });
    expect(metrics.realism_index).toBeGreaterThan(0);
    const benches = compareAgainstBenchmarks({ metrics, sessions });
    expect(benches.some((b) => b.source === "synthetic_baseline")).toBe(true);
    expect(
      benches.some((b) =>
        b.notes.some((n) => n === "never_trains" || n === "comparison_only"),
      ),
    ).toBe(true);

    const psy = evaluatePsychometrics(sessions);
    expect(psy.find((p) => p.kind === "criterion_validity")?.score).toBeNull();
    expect(psy.every((p) => p.significance_claimed === false)).toBe(true);

    const pub = buildPublicationSupport({ runs: [run] });
    expect(pub.disclaimer).toMatch(/not clinically validated/i);
    expect(pub.statistical_summaries.every((s) => s.significance_claimed === false)).toBe(
      true,
    );

    const pkg = buildResearchDatasetPackage({ runs: [run], ratings: [] });
    expect(pkg.anonymized).toBe(true);
    expect(pkg.fhir_bundle?.resourceType).toBe("Bundle");
    expect(exportRunsCsv([run])).toMatch(/realism_overall/);

    const dash = buildValidationDashboard([run], []);
    expect(dash.n_runs).toBe(1);
    expect(dash.limitations.length).toBeGreaterThan(0);

    const audits = buildAuditReports({
      session: sessions[0]!,
      realism: run.realism,
      dsm: run.dsm,
      consistency: run.consistency,
      metrics,
    });
    expect(audits).toHaveLength(6);
  });
});

describe("Longitudinal + 500-session simulation", () => {
  it("evaluates all horizons and marks padded ones simulated", () => {
    const sessions = simulateLongitudinalCorpus(12, "long-12");
    const horizons = evaluateLongitudinal({ sessions, seed: "t" });
    expect(horizons).toHaveLength(6);
    expect(horizons.find((h) => h.horizon === 10)?.simulated).toBe(false);
    expect(horizons.find((h) => h.horizon === 500)?.simulated).toBe(true);
  });

  it("simulates 500 sessions within a reasonable budget", () => {
    const t0 = performance.now();
    const sessions = simulateLongitudinalCorpus(500, "perf-500");
    expect(sessions).toHaveLength(500);
    const sample = sessions.slice(0, 20);
    for (let i = 0; i < sample.length; i++) {
      runValidationPipeline({
        session: sample[i]!,
        sessionsForPsychometrics: sample.slice(0, i + 1),
        persist: false,
        seed: `perf:${i}`,
      });
    }
    const elapsed = performance.now() - t0;
    // Observational batch should stay well under a few seconds in CI.
    expect(elapsed).toBeLessThan(15_000);
  });
});

describe("Reliability without fabricating significance", () => {
  it("returns null overall when no ratings", () => {
    const sessions = simulateLongitudinalCorpus(2, "rel");
    const r = scoreReliability({ sessions, ratings: [] });
    expect(r.overall).toBeNull();
    expect(r.notes.some((n) => /No expert ratings/i.test(n))).toBe(true);
  });
});

/**
 * Clinical Benchmark Engine — compare VPsych against baselines.
 * Never trains. Only compares.
 */

import { clamp01to100, mean } from "@/lib/validation/helpers";
import {
  GOLD_STANDARD_CASES,
  SYNTHETIC_BASELINE,
  distanceToGold,
} from "@/lib/validation/ground-truth";
import type {
  BenchmarkCase,
  BenchmarkComparison,
  BenchmarkSource,
  QualityMetricsBundle,
  SessionObservables,
} from "@/lib/validation/types";

export const HISTORICAL_SIMULATION_CORPUS: BenchmarkCase[] = [
  {
    id: "hist-sim-01",
    source: "historical_simulation",
    label: "Historical simulation cohort mean",
    disorder_slug: null,
    observables: {},
    gold_scores: {
      realism_index: 70,
      consistency_index: 72,
      clinical_fidelity: 68,
      conversation_quality: 71,
      session_quality: 69,
    },
  },
];

export function buildBenchmarkSuite(): BenchmarkCase[] {
  return [
    SYNTHETIC_BASELINE,
    ...GOLD_STANDARD_CASES,
    ...HISTORICAL_SIMULATION_CORPUS,
  ];
}

export function compareAgainstBenchmarks(input: {
  metrics: QualityMetricsBundle;
  sessions?: SessionObservables[];
}): BenchmarkComparison[] {
  const suite = buildBenchmarkSuite();
  const out: BenchmarkComparison[] = [];

  for (const bench of suite) {
    const keys = Object.keys(bench.gold_scores ?? {}) as Array<
      keyof QualityMetricsBundle
    >;
    for (const metric of keys) {
      const baseline = bench.gold_scores?.[metric];
      const vpsych = input.metrics[metric];
      if (typeof baseline !== "number") continue;
      out.push({
        metric: String(metric),
        vpsych: typeof vpsych === "number" ? vpsych : null,
        baseline,
        delta:
          typeof vpsych === "number"
            ? Math.round((vpsych - baseline) * 10) / 10
            : null,
        source: bench.source,
        notes: [
          `benchmark=${bench.id}`,
          "never_trains",
          "comparison_only",
        ],
      });
    }

    const mad = distanceToGold(input.metrics, bench);
    if (mad.mean_abs_delta != null) {
      out.push({
        metric: "mean_abs_delta_to_benchmark",
        vpsych: clamp01to100(100 - mad.mean_abs_delta),
        baseline: 100,
        delta: clamp01to100(100 - mad.mean_abs_delta) - 100,
        source: bench.source,
        notes: mad.notes,
      });
    }
  }

  if (input.sessions?.length) {
    const overalls = input.sessions
      .map((s) => s.assessment?.overall)
      .filter((x): x is number => typeof x === "number");
    if (overalls.length) {
      out.push({
        metric: "session_overall_mean",
        vpsych: Math.round(mean(overalls) * 10) / 10,
        baseline: SYNTHETIC_BASELINE.gold_scores?.session_quality ?? 40,
        delta: Math.round((mean(overalls) - 40) * 10) / 10,
        source: "synthetic_baseline",
        notes: [`n=${overalls.length}`, "assessment_overall_is_educational"],
      });
    }
  }

  return out;
}

export function sourcesCovered(comparisons: BenchmarkComparison[]): BenchmarkSource[] {
  return [...new Set(comparisons.map((c) => c.source))];
}

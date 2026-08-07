/**
 * Ground Truth Engine — gold-standard scenario anchors for comparison.
 * Never trains models. Observational comparison only.
 */

import { clamp01to100, mean } from "@/lib/validation/helpers";
import type {
  BenchmarkCase,
  QualityMetricId,
  RealismDimensionId,
  SessionObservables,
} from "@/lib/validation/types";

export const GOLD_STANDARD_CASES: BenchmarkCase[] = [
  {
    id: "gold-mdd-en",
    source: "gold_standard",
    label: "Expert-authored MDD interview (EN)",
    disorder_slug: "mdd",
    observables: {},
    gold_scores: {
      speech_realism: 88,
      emotion_realism: 90,
      diagnostic_realism: 92,
      mse_realism: 90,
      clinical_fidelity: 90,
      realism_index: 89,
    },
  },
  {
    id: "gold-gad-ar",
    source: "gold_standard",
    label: "Expert-authored GAD interview (AR)",
    disorder_slug: "gad",
    observables: {},
    gold_scores: {
      speech_realism: 86,
      emotion_realism: 88,
      diagnostic_realism: 90,
      alliance_score: 85,
      realism_index: 87,
    },
  },
  {
    id: "expert-ptsd",
    source: "expert_authored",
    label: "Expert PTSD vignette",
    disorder_slug: "ptsd",
    observables: {},
    gold_scores: {
      risk_behaviour: 90,
      protective_factors: 80,
      diagnostic_realism: 91,
      clinical_fidelity: 88,
    },
  },
];

export const SYNTHETIC_BASELINE: BenchmarkCase = {
  id: "synthetic-baseline",
  source: "synthetic_baseline",
  label: "Low-fidelity synthetic baseline",
  disorder_slug: null,
  observables: {},
  gold_scores: {
    realism_index: 45,
    consistency_index: 50,
    clinical_fidelity: 40,
    conversation_quality: 42,
    session_quality: 40,
  },
};

export function distanceToGold(
  observed: Partial<Record<RealismDimensionId | QualityMetricId, number>>,
  gold: BenchmarkCase,
): { mean_abs_delta: number | null; n: number; notes: string[] } {
  const deltas: number[] = [];
  const g = gold.gold_scores ?? {};
  for (const [k, v] of Object.entries(g)) {
    const o = observed[k as keyof typeof observed];
    if (typeof o === "number" && typeof v === "number") {
      deltas.push(Math.abs(o - v));
    }
  }
  return {
    mean_abs_delta: deltas.length ? mean(deltas) : null,
    n: deltas.length,
    notes: [
      `gold_id=${gold.id}`,
      "comparison_only_never_trains",
      deltas.length ? `mad=${Math.round(mean(deltas) * 10) / 10}` : "no_overlap",
    ],
  };
}

export function groundTruthScorecard(
  sessions: SessionObservables[],
  observedMetrics: Partial<Record<RealismDimensionId | QualityMetricId, number>>,
): {
  comparisons: Array<{
    gold_id: string;
    source: BenchmarkCase["source"];
    mean_abs_delta: number | null;
  }>;
  nearest_gold_id: string | null;
  fidelity_proxy: number | null;
} {
  const comparisons = GOLD_STANDARD_CASES.map((g) => {
    const d = distanceToGold(observedMetrics, g);
    return {
      gold_id: g.id,
      source: g.source,
      mean_abs_delta: d.mean_abs_delta,
    };
  });
  const usable = comparisons.filter((c) => c.mean_abs_delta != null);
  usable.sort((a, b) => (a.mean_abs_delta ?? 99) - (b.mean_abs_delta ?? 99));
  const nearest = usable[0] ?? null;
  const fidelity =
    nearest?.mean_abs_delta == null
      ? null
      : clamp01to100(100 - nearest.mean_abs_delta);

  return {
    comparisons,
    nearest_gold_id: nearest?.gold_id ?? null,
    fidelity_proxy: fidelity,
    // sessions reserved for future matched gold lookup
    ...(sessions.length >= 0 ? {} : {}),
  };
}

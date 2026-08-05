/**
 * Aggregate ALE scores for adaptive dashboard.
 */

import type {
  AdaptiveLearningEffectiveness,
  AleAggregateRow,
  AleDashboardData,
} from "@/lib/ale/types";
import { ALE_VERSION } from "@/lib/ale/weights";

export type StoredAleRecord = {
  overall: number;
  learner_archetype: string;
  computed_at: string;
  ale: AdaptiveLearningEffectiveness;
};

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

function aggregate(key: string, scores: number[]): AleAggregateRow {
  const m = mean(scores);
  const s = sd(scores);
  const se = scores.length ? s / Math.sqrt(scores.length) : 0;
  const margin = 1.96 * se;
  return {
    key,
    n: scores.length,
    mean: Math.round(m * 10) / 10,
    sd: Math.round(s * 10) / 10,
    min: scores.length ? Math.min(...scores) : 0,
    max: scores.length ? Math.max(...scores) : 0,
    ci95: {
      lower: Math.round(Math.max(0, m - margin) * 10) / 10,
      upper: Math.round(Math.min(100, m + margin) * 10) / 10,
    },
  };
}

export function buildAleDashboard(records: StoredAleRecord[]): AleDashboardData {
  const overalls = records.map((r) => r.overall);
  const byArch = new Map<string, number[]>();
  const dimMeans = new Map<string, number[]>();
  const learning_curves: AleDashboardData["learning_curves"] = [];
  const difficulty_curves: AleDashboardData["difficulty_curves"] = [];

  for (const r of records) {
    const arr = byArch.get(r.learner_archetype) ?? [];
    arr.push(r.overall);
    byArch.set(r.learner_archetype, arr);
    learning_curves.push({
      archetype: r.learner_archetype,
      points: r.ale.learning_curve,
    });
    difficulty_curves.push({
      archetype: r.learner_archetype,
      points: r.ale.difficulty_curve,
    });
    for (const s of r.ale.subscores) {
      const xs = dimMeans.get(s.id) ?? [];
      xs.push(s.score);
      dimMeans.set(s.id, xs);
    }
  }

  const lowRecs = new Set<string>();
  for (const r of records) {
    if (r.overall < 75) {
      for (const rec of r.ale.recommendations.slice(0, 3)) lowRecs.add(rec);
    }
  }

  const hotspots = [...dimMeans.entries()]
    .map(([id, xs]) => ({
      id,
      mean: Math.round(mean(xs) * 10) / 10,
      n: xs.length,
    }))
    .sort((a, b) => a.mean - b.mean)
    .slice(0, 5);

  return {
    ale_version: ALE_VERSION,
    overall_mean: overalls.length
      ? Math.round(mean(overalls) * 10) / 10
      : null,
    n: records.length,
    learning_curves,
    difficulty_curves,
    by_archetype: [...byArch.entries()]
      .map(([k, xs]) => aggregate(k, xs))
      .sort((a, b) => a.key.localeCompare(b.key)),
    curriculum_quality: {
      mean_ale: overalls.length
        ? Math.round(mean(overalls) * 10) / 10
        : null,
      low_dimension_hotspots: hotspots,
      recommendations: [...lowRecs].slice(0, 10),
    },
    low_ale_recommendations: [...lowRecs].slice(0, 15),
  };
}

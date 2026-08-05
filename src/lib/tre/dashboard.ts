/**
 * TRI dashboard aggregations for admin / validation surfaces.
 */

import { listTriHistory, type TherapyResponseIndex } from "@/lib/tre/tri";
import { TRI_VERSION } from "@/lib/tre/types";

export type TriDashboard = {
  tri_version: string;
  n: number;
  mean_overall: number | null;
  by_disorder: Array<{
    disorder_slug: string;
    n: number;
    mean_overall: number;
  }>;
  by_modality: Array<{
    modality: string;
    n: number;
    mean_overall: number;
  }>;
  by_trajectory: Record<string, number>;
  timeline: Array<{ at: string; mean: number; n: number }>;
  recent: Array<{
    overall: number;
    disorder_slug: string;
    modality: string;
    trajectory: string;
    computed_at: string;
  }>;
};

export function buildTriDashboard(
  records = listTriHistory(2000),
): TriDashboard {
  if (!records.length) {
    return {
      tri_version: TRI_VERSION,
      n: 0,
      mean_overall: null,
      by_disorder: [],
      by_modality: [],
      by_trajectory: {},
      timeline: [],
      recent: [],
    };
  }

  const mean =
    records.reduce((a, r) => a + r.overall, 0) / records.length;

  const byDisorder = new Map<string, number[]>();
  const byModality = new Map<string, number[]>();
  const byTrajectory: Record<string, number> = {};
  const byDay = new Map<string, number[]>();

  for (const r of records) {
    const d = byDisorder.get(r.disorder_slug) ?? [];
    d.push(r.overall);
    byDisorder.set(r.disorder_slug, d);

    const m = byModality.get(r.modality) ?? [];
    m.push(r.overall);
    byModality.set(r.modality, m);

    const traj = r.tri.trajectory;
    byTrajectory[traj] = (byTrajectory[traj] ?? 0) + 1;

    const day = r.computed_at.slice(0, 10);
    const dayScores = byDay.get(day) ?? [];
    dayScores.push(r.overall);
    byDay.set(day, dayScores);
  }

  const avg = (xs: number[]) =>
    Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;

  return {
    tri_version: TRI_VERSION,
    n: records.length,
    mean_overall: Math.round(mean * 10) / 10,
    by_disorder: [...byDisorder.entries()]
      .map(([disorder_slug, xs]) => ({
        disorder_slug,
        n: xs.length,
        mean_overall: avg(xs),
      }))
      .sort((a, b) => a.disorder_slug.localeCompare(b.disorder_slug)),
    by_modality: [...byModality.entries()]
      .map(([modality, xs]) => ({
        modality,
        n: xs.length,
        mean_overall: avg(xs),
      }))
      .sort((a, b) => a.modality.localeCompare(b.modality)),
    by_trajectory: byTrajectory,
    timeline: [...byDay.entries()]
      .map(([at, xs]) => ({ at, mean: avg(xs), n: xs.length }))
      .sort((a, b) => a.at.localeCompare(b.at)),
    recent: records.slice(-25).map((r) => ({
      overall: r.overall,
      disorder_slug: r.disorder_slug,
      modality: r.modality,
      trajectory: r.tri.trajectory,
      computed_at: r.computed_at,
    })),
  };
}

/** Offline calibration: run high-competence courses for dashboard seed. */
export function seedTriOfflineSample(
  simulate: (opts: {
    modality: "cbt" | "supportive" | "dbt";
    disorder_slug: string;
    category?: string | null;
    sessions: number;
    competence: number;
    alliance: number;
  }) => { treatment: import("@/lib/tre/types").TreatmentState },
  compute: (t: import("@/lib/tre/types").TreatmentState) => TherapyResponseIndex,
  record: (row: {
    overall: number;
    disorder_slug: string;
    modality: string;
    tri: TherapyResponseIndex;
  }) => void,
): void {
  const samples: Array<{
    slug: string;
    category: string;
    modality: "cbt" | "supportive" | "dbt";
  }> = [
    { slug: "mdd-recurrent-moderate", category: "mood", modality: "cbt" },
    { slug: "bpd", category: "personality", modality: "dbt" },
    { slug: "alcohol-use-disorder", category: "substance", modality: "supportive" },
  ];
  for (const s of samples) {
    const { treatment } = simulate({
      modality: s.modality,
      disorder_slug: s.slug,
      category: s.category,
      sessions: 5,
      competence: 78,
      alliance: 72,
    });
    const tri = compute(treatment);
    record({
      overall: tri.overall,
      disorder_slug: s.slug,
      modality: s.modality,
      tri,
    });
  }
}

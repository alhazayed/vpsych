/**
 * Assessment accuracy study — expert vs platform score pairs.
 * Never invents expert scores.
 */

import type { AssessmentAccuracyRow } from "@/lib/cvl/types";
import { mean } from "@/lib/cvl/statistics";

function pearson(
  xs: number[],
  ys: number[],
): number | null {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const mx = mean(xs);
  const my = mean(ys);
  if (mx == null || my == null) return null;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function validateAssessmentAccuracy(
  raw: unknown,
):
  | { ok: true; row: AssessmentAccuracyRow }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<AssessmentAccuracyRow>;
  if (!body.study_id || !body.case_ref || !body.disorder_slug) {
    return { ok: false, error: "study_id, case_ref, disorder_slug required" };
  }
  if (!body.rater_token) {
    return { ok: false, error: "rater_token required (opaque)" };
  }
  if (
    !body.expert_scores ||
    typeof body.expert_scores !== "object" ||
    !body.platform_scores ||
    typeof body.platform_scores !== "object"
  ) {
    return { ok: false, error: "expert_scores and platform_scores required" };
  }
  const keys = Object.keys(body.expert_scores);
  if (!keys.length) {
    return { ok: false, error: "expert_scores must include at least one metric" };
  }
  for (const k of keys) {
    const e = body.expert_scores[k];
    const p = body.platform_scores[k];
    if (typeof e !== "number" || !Number.isFinite(e)) {
      return { ok: false, error: `expert_scores.${k} must be numeric` };
    }
    if (typeof p !== "number" || !Number.isFinite(p)) {
      return { ok: false, error: `platform_scores.${k} missing or non-numeric` };
    }
  }

  const stats = scoreAssessmentPair(body.expert_scores, body.platform_scores);
  return {
    ok: true,
    row: {
      study_id: body.study_id,
      case_ref: body.case_ref,
      disorder_slug: body.disorder_slug,
      expert_scores: body.expert_scores,
      platform_scores: body.platform_scores,
      absolute_error: stats.absolute_error,
      correlation: stats.correlation,
      rater_token: body.rater_token,
      notes: body.notes,
      rated_at: body.rated_at ?? new Date().toISOString(),
    },
  };
}

export function scoreAssessmentPair(
  expert: Record<string, number>,
  platform: Record<string, number>,
): { absolute_error: number | null; correlation: number | null } {
  const keys = Object.keys(expert).filter((k) => k in platform);
  if (!keys.length) return { absolute_error: null, correlation: null };
  const xs = keys.map((k) => expert[k]!);
  const ys = keys.map((k) => platform[k]!);
  const abs = keys.map((k) => Math.abs(expert[k]! - platform[k]!));
  return {
    absolute_error: mean(abs),
    correlation: pearson(xs, ys),
  };
}

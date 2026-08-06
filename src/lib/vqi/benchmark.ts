/**
 * VQI benchmarking across entities and references.
 */

import type { VqiBenchmarkComparison } from "@/lib/vqi/types";

export function compareToBenchmark(
  current: number,
  reference: number,
  label: string,
  threshold = 5,
): VqiBenchmarkComparison {
  const delta = Math.round((current - reference) * 10) / 10;
  return {
    label,
    reference: Math.round(reference * 10) / 10,
    current: Math.round(current * 10) / 10,
    delta,
    meaningful: Math.abs(delta) >= threshold,
    method: "abs_diff_gt_5",
  };
}

export function buildBenchmarkSuite(opts: {
  current: number;
  previous_assessment?: number | null;
  previous_learner?: number | null;
  institution_avg?: number | null;
  platform_avg?: number | null;
  language_avg?: number | null;
  disorder_avg?: number | null;
  template_avg?: number | null;
  release_avg?: number | null;
  model_avg?: number | null;
}): VqiBenchmarkComparison[] {
  const out: VqiBenchmarkComparison[] = [];
  const pairs: Array<[string, number | null | undefined]> = [
    ["previous_assessment", opts.previous_assessment],
    ["previous_learner", opts.previous_learner],
    ["institution_average", opts.institution_avg],
    ["platform_average", opts.platform_avg],
    ["language_average", opts.language_avg],
    ["disorder_average", opts.disorder_avg],
    ["template_average", opts.template_avg],
    ["release_average", opts.release_avg],
    ["ai_model_average", opts.model_avg],
  ];
  for (const [label, ref] of pairs) {
    if (ref == null) continue;
    out.push(compareToBenchmark(opts.current, ref, label));
  }
  return out;
}

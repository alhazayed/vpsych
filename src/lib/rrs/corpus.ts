/**
 * Offline RRS corpus — platform research-readiness snapshots.
 */

import { computeResearchReadinessScore } from "@/lib/rrs/engine";
import { rrsInputFromPlatform } from "@/lib/rrs/from-platform";
import type { StoredRrsRecord } from "@/lib/rrs/aggregate";

/**
 * Build offline RRS corpus (current platform snapshot + disclosed-gap variants).
 */
export function buildRrsOfflineCorpus(): StoredRrsRecord[] {
  const base = rrsInputFromPlatform({
    dataset_id: "vpsych-platform",
    model_version: "gpt-research",
  });
  const withModel = computeResearchReadinessScore(base);

  // Heuristic-only assessment path (still disclosed)
  const heuristic = computeResearchReadinessScore({
    ...base,
    dataset_id: "vpsych-heuristic-degraded",
    has_model_stamp: false,
    heuristic_disclosed: true,
    model_version: null,
  });

  // Idealized future state with export+anonymization+GDPR productized
  // (kept as separate row for gap analysis — not claimed as current)
  const future = computeResearchReadinessScore({
    ...base,
    dataset_id: "vpsych-research-export-target",
    research_export_api_present: true,
    anonymization_pipeline_present: true,
    gdpr_dsar_productized: true,
    gdpr_documented: true,
    export_version: "1.0.0",
  });

  const now = new Date().toISOString();
  return [
    {
      overall: withModel.overall,
      dataset_id: "vpsych-platform",
      computed_at: now,
      rrs: withModel,
    },
    {
      overall: heuristic.overall,
      dataset_id: "vpsych-heuristic-degraded",
      computed_at: now,
      rrs: heuristic,
    },
    {
      overall: future.overall,
      dataset_id: "vpsych-research-export-target",
      computed_at: now,
      rrs: future,
    },
  ];
}

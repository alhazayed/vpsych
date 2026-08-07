/**
 * Metrics Engine — quality indices from observational validation outputs.
 */

import { clamp01to100, mean } from "@/lib/validation/helpers";
import type {
  DimensionScore,
  QualityMetricId,
  QualityMetricsBundle,
  SessionObservables,
} from "@/lib/validation/types";

export function buildQualityMetrics(input: {
  realismOverall: number;
  consistencyOverall: number;
  dsmOverall: number;
  realismDimensions: DimensionScore[];
  sessions: SessionObservables[];
}): QualityMetricsBundle {
  const dim = (id: string): number | null => {
    const d = input.realismDimensions.find((x) => x.id === id);
    return d ? d.score : null;
  };

  const memory = dim("memory_realism") ?? 50;
  const alliance = dim("alliance_realism") ?? 50;
  const behaviour = dim("behaviour_realism") ?? 50;
  const conversation = dim("conversation_flow") ?? 50;
  const diagnostic = dim("diagnostic_realism") ?? input.dsmOverall;

  const fidelityFromLedger = mean(
    input.sessions
      .map((s) => s.ledger_metrics?.clinical_fidelity ?? s.ledger_metrics?.CFI)
      .filter((x): x is number => typeof x === "number"),
  );

  const clinical_fidelity = Number.isFinite(fidelityFromLedger)
    ? clamp01to100(fidelityFromLedger)
    : clamp01to100((input.dsmOverall + diagnostic) / 2);

  const session_quality = clamp01to100(
    mean([
      input.realismOverall,
      input.consistencyOverall,
      conversation,
      alliance,
    ]),
  );

  const decision_stability = clamp01to100(
    mean([input.consistencyOverall, diagnostic, behaviour]),
  );

  const bundle: QualityMetricsBundle = {
    realism_index: clamp01to100(input.realismOverall),
    consistency_index: clamp01to100(input.consistencyOverall),
    clinical_fidelity,
    memory_integrity: clamp01to100(memory),
    diagnostic_stability: clamp01to100(diagnostic),
    conversation_quality: clamp01to100(conversation),
    alliance_score: clamp01to100(alliance),
    behaviour_stability: clamp01to100(behaviour),
    decision_stability,
    session_quality,
  };

  return bundle;
}

export const QUALITY_METRIC_IDS: QualityMetricId[] = [
  "realism_index",
  "consistency_index",
  "clinical_fidelity",
  "memory_integrity",
  "diagnostic_stability",
  "conversation_quality",
  "alliance_score",
  "behaviour_stability",
  "decision_stability",
  "session_quality",
];

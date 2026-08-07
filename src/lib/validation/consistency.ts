/**
 * Consistency Engine — internal consistency of observables across a session.
 */

import { clamp01to100, weightedMean } from "@/lib/validation/helpers";
import type { DimensionScore, SessionObservables } from "@/lib/validation/types";

export function scoreConsistency(obs: SessionObservables): {
  overall: number;
  dimensions: DimensionScore[];
} {
  const c = obs.clinical;
  const dims: DimensionScore[] = [];

  const identity =
    c.disorder_slug && (c.dsm5_code || c.icd11_code)
      ? 85
      : c.disorder_slug
        ? 65
        : 40;
  dims.push({
    id: "identity_consistency",
    score: clamp01to100(identity),
    weight: 20,
    confidence: 90,
    evidence: [`slug=${c.disorder_slug ?? "none"}`],
    notes: [],
  });

  const codePair =
    c.dsm5_code && c.icd11_code ? 88 : c.dsm5_code || c.icd11_code ? 70 : 35;
  dims.push({
    id: "coding_consistency",
    score: clamp01to100(codePair),
    weight: 15,
    confidence: 85,
    evidence: [`dsm5=${c.dsm5_code}`, `icd11=${c.icd11_code}`],
    notes: [],
  });

  const symptom =
    c.symptom_count >= 3 ? 80 : c.symptom_count >= 1 ? 60 : 30;
  dims.push({
    id: "symptom_consistency",
    score: clamp01to100(symptom),
    weight: 15,
    confidence: 75,
    evidence: [`symptom_count=${c.symptom_count}`],
    notes: [],
  });

  const localeOk = Boolean(c.locale);
  dims.push({
    id: "locale_consistency",
    score: localeOk ? 90 : 40,
    weight: 10,
    confidence: 95,
    evidence: [`locale=${c.locale}`],
    notes: [],
  });

  const turnOk =
    obs.patient_turn_count > 0 && obs.therapist_turn_count > 0 ? 78 : 45;
  dims.push({
    id: "dialogue_role_consistency",
    score: clamp01to100(turnOk),
    weight: 15,
    confidence: 80,
    evidence: [
      `therapist=${obs.therapist_turn_count}`,
      `patient=${obs.patient_turn_count}`,
    ],
    notes: [],
  });

  const assess =
    obs.assessment == null
      ? 50
      : obs.assessment.overall >= 0 && obs.assessment.overall <= 100
        ? 82
        : 20;
  dims.push({
    id: "assessment_bound_consistency",
    score: clamp01to100(assess),
    weight: 10,
    confidence: 90,
    evidence: [
      `overall=${obs.assessment?.overall ?? "n/a"}`,
      "does_not_fork_weightedOverall",
    ],
    notes: [],
  });

  const coreRichness =
    (c.has_mse ? 20 : 0) +
    (c.has_protective_factors ? 20 : 0) +
    (c.has_formulation ? 20 : 0) +
    (c.has_personality_freeze ? 20 : 0) +
    (c.has_scientific_meta ? 20 : 0);
  dims.push({
    id: "clinical_core_richness",
    score: clamp01to100(coreRichness),
    weight: 15,
    confidence: 85,
    evidence: ["observational_core_flags"],
    notes: [],
  });

  return {
    overall: weightedMean(
      dims.map((d) => ({ score: d.score, weight: d.weight })),
    ),
    dimensions: dims,
  };
}

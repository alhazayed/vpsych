/**
 * Scenario Validator — DSM/ICD coherence checks (consistency only).
 * Never assigns diagnoses.
 */

import { clamp01to100, weightedMean } from "@/lib/validation/helpers";
import type {
  DimensionScore,
  DsmValidationDimensionId,
  SessionObservables,
} from "@/lib/validation/types";

const WEIGHTS: Record<DsmValidationDimensionId, number> = {
  dsm_coherence: 15,
  icd_coherence: 15,
  differential_reasoning: 12,
  symptom_overlap: 12,
  comorbidity_realism: 12,
  timeline_realism: 12,
  severity_realism: 12,
  subtype_realism: 10,
};

function dim(
  id: DsmValidationDimensionId,
  score: number,
  evidence: string[],
  notes: string[] = [],
): DimensionScore {
  return {
    id,
    score: clamp01to100(score),
    weight: WEIGHTS[id],
    confidence: 80,
    evidence,
    notes,
  };
}

/** Impossible timeline heuristics (observational). */
export function detectImpossibleTimeline(
  slug: string | null,
  onset: string | null | undefined,
): boolean {
  if (!slug || !onset) return false;
  const o = onset.toLowerCase();
  if (slug === "pdd" && /weeks?/.test(o) && !/year/.test(o)) return true;
  if (slug === "delirium" && /weeks?|months?/.test(o) && !/hour/.test(o))
    return true;
  if (slug === "bipolar-mania" && /years?/.test(o) && !/day/.test(o)) return true;
  return false;
}

export function validateScenarioDsm(obs: SessionObservables): {
  overall: number;
  dimensions: DimensionScore[];
} {
  const c = obs.clinical;
  const dims: DimensionScore[] = [];

  dims.push(
    dim(
      "dsm_coherence",
      c.dsm5_code ? 88 : c.disorder_slug ? 55 : 25,
      [`dsm5=${c.dsm5_code ?? "missing"}`],
      ["Consistency only — does not assign DSM diagnoses"],
    ),
  );
  dims.push(
    dim(
      "icd_coherence",
      c.icd11_code ? 88 : c.disorder_slug ? 55 : 25,
      [`icd11=${c.icd11_code ?? "missing"}`],
      ["Consistency only — does not assign ICD diagnoses"],
    ),
  );
  dims.push(
    dim(
      "differential_reasoning",
      c.differentials_count >= 2
        ? 85
        : c.differentials_count === 1
          ? 70
          : c.rule_outs_count > 0
            ? 60
            : 40,
      [
        `differentials=${c.differentials_count}`,
        `rule_outs=${c.rule_outs_count}`,
      ],
    ),
  );

  const domains = c.symptom_domains.length;
  dims.push(
    dim(
      "symptom_overlap",
      domains >= 2 || c.symptom_count >= 3 ? 78 : c.symptom_count > 0 ? 55 : 30,
      [`domains=${domains}`, `symptoms=${c.symptom_count}`],
    ),
  );

  const comorbidOk =
    c.comorbidities.length === 0
      ? 72
      : c.comorbidities.every((x) => Boolean(x.slug))
        ? 80
        : 45;
  dims.push(
    dim("comorbidity_realism", comorbidOk, [
      `comorbid_count=${c.comorbidities.length}`,
    ]),
  );

  const impossible = detectImpossibleTimeline(c.disorder_slug, c.onset_duration);
  dims.push(
    dim(
      "timeline_realism",
      impossible ? 25 : c.onset_duration ? 82 : 60,
      [
        `onset=${c.onset_duration ?? "unset"}`,
        `impossible=${impossible}`,
      ],
    ),
  );

  dims.push(
    dim(
      "severity_realism",
      c.severity ? 80 : 55,
      [`severity=${c.severity ?? "unset"}`],
    ),
  );

  dims.push(
    dim(
      "subtype_realism",
      c.teaching_points_count > 0 || c.has_formulation ? 75 : 55,
      [
        `teaching_points=${c.teaching_points_count}`,
        `formulation=${c.has_formulation}`,
      ],
    ),
  );

  return {
    overall: weightedMean(
      dims.map((d) => ({ score: d.score, weight: d.weight })),
    ),
    dimensions: dims,
  };
}

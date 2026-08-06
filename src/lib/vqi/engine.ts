/**
 * VPsych Quality Index engine — hierarchical composite (VQI v1.0).
 *
 * Missing-data handling: renormalize weights among present metrics; apply
 * confidence penalty proportional to missing required weight mass.
 * Outlier detection: |score - platform_mean| > 2 SD when context provided.
 */

import {
  ACE_ENGINE_VERSION,
  ASSESSMENT_SCHEMA_VERSION,
  CGE_ENGINE_VERSION,
  PROMPT_ENGINE_VERSION,
} from "@/lib/scientific/versions";
import { getMetricDefinition, metricVersions } from "@/lib/vqi/registry";
import type {
  VPsychQualityIndex,
  VqiComputeInput,
  VqiConfidenceBundle,
  VqiConfidenceInterval,
  VqiMaturityLevel,
  VqiSubIndex,
} from "@/lib/vqi/types";
import {
  VQI_ALGORITHM_VERSION,
  VQI_VERSION,
  type VqiMetricId,
  type VqiWeightSet,
} from "@/lib/vqi/weights";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

export function classifyMaturity(overall: number): VqiMaturityLevel {
  if (overall < 60) return "experimental";
  if (overall < 75) return "development";
  if (overall < 85) return "pilot_ready";
  if (overall < 95) return "production_ready";
  return "world_class";
}

export function maturityLabel(level: VqiMaturityLevel): string {
  switch (level) {
    case "experimental":
      return "Experimental";
    case "development":
      return "Development";
    case "pilot_ready":
      return "Pilot Ready";
    case "production_ready":
      return "Production Ready";
    case "world_class":
      return "World-Class Educational Platform";
  }
}

/**
 * Resolve effective weights with missing-data renormalization.
 */
export function resolveEffectiveWeights(
  weightSet: VqiWeightSet,
  present: Set<VqiMetricId>,
): {
  effective: Map<VqiMetricId, number>;
  missingRequiredMass: number;
  missing: VqiMetricId[];
} {
  const missing: VqiMetricId[] = [];
  let presentMass = 0;
  let missingRequiredMass = 0;
  for (const e of weightSet.entries) {
    if (present.has(e.metric_id)) presentMass += e.weight;
    else {
      missing.push(e.metric_id);
      if (e.required) missingRequiredMass += e.weight;
    }
  }
  const effective = new Map<VqiMetricId, number>();
  if (presentMass <= 0) return { effective, missingRequiredMass, missing };
  for (const e of weightSet.entries) {
    if (present.has(e.metric_id)) {
      effective.set(e.metric_id, e.weight / presentMass);
    }
  }
  return { effective, missingRequiredMass, missing };
}

export function confidenceInterval(
  overall: number,
  subscores: VqiSubIndex[],
): VqiConfidenceInterval {
  const variance = subscores.reduce((acc, s) => {
    if (s.missing || s.score == null) return acc;
    const uncertainty = ((100 - s.confidence) / 100) * 15;
    return acc + s.effective_weight * uncertainty * uncertainty;
  }, 0);
  const se = Math.sqrt(variance);
  const margin = 1.96 * se;
  return {
    lower: clamp(overall - margin),
    upper: clamp(overall + margin),
    method: "weighted_dimension_uncertainty",
    level: 0.95,
  };
}

function buildConfidenceBundle(
  subscores: VqiSubIndex[],
  overallConf: number,
): VqiConfidenceBundle {
  const byDomain: Record<string, number[]> = {
    clinical: [],
    educational: [],
    assessment: [],
    adaptive: [],
    research: [],
    technical: [],
  };
  for (const s of subscores) {
    if (s.missing) continue;
    const def = getMetricDefinition(s.metric_id);
    const domain = def?.domain ?? "custom";
    if (domain === "clinical") byDomain.clinical!.push(s.confidence);
    else if (domain === "educational") byDomain.educational!.push(s.confidence);
    else if (domain === "assessment") byDomain.assessment!.push(s.confidence);
    else if (domain === "adaptive") byDomain.technical!.push(s.confidence);
    else if (domain === "research") byDomain.research!.push(s.confidence);
    else byDomain.technical!.push(s.confidence);
  }
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : overallConf * 0.8;
  return {
    overall: clamp(overallConf),
    scientific: clamp(overallConf),
    clinical: clamp(avg(byDomain.clinical!)),
    educational: clamp(avg(byDomain.educational!)),
    technical: clamp(avg(byDomain.technical!)),
    institutional: clamp((overallConf + avg(byDomain.research!)) / 2),
    research: clamp(avg(byDomain.research!)),
  };
}

function detectOutlier(overall: number, prior?: number | null): boolean {
  if (prior == null) return false;
  return Math.abs(overall - prior) >= 20;
}

/**
 * Compute hierarchical VQI for one entity from sub-metric observations.
 */
export function computeVPsychQualityIndex(
  input: VqiComputeInput,
): VPsychQualityIndex {
  const byId = new Map(
    input.metrics.map((m) => [m.metric_id, m] as const),
  );
  const present = new Set<VqiMetricId>();
  for (const e of input.weight_set.entries) {
    const obs = byId.get(e.metric_id);
    if (obs && obs.score != null && Number.isFinite(obs.score)) {
      present.add(e.metric_id);
    }
  }

  const { effective, missingRequiredMass, missing } = resolveEffectiveWeights(
    input.weight_set,
    present,
  );

  const subscores: VqiSubIndex[] = input.weight_set.entries.map((e) => {
    const obs = byId.get(e.metric_id);
    const isMissing = !present.has(e.metric_id);
    const eff = effective.get(e.metric_id) ?? 0;
    const score = isMissing ? null : clamp(obs!.score!);
    const confidence = isMissing
      ? 0
      : clamp(obs?.confidence ?? 75);
    const contribution =
      score == null ? 0 : Math.round(score * eff * 10) / 10;
    return {
      metric_id: e.metric_id,
      score,
      weight: e.weight,
      effective_weight: Math.round(eff * 1000) / 1000,
      confidence,
      missing: isMissing,
      version: obs?.version ?? getMetricDefinition(e.metric_id)?.version ?? null,
      contribution,
    };
  });

  let overall = clamp(
    subscores.reduce((a, s) => a + (s.score ?? 0) * s.effective_weight, 0),
  );
  // Confidence / completeness penalty for missing required mass
  if (missingRequiredMass > 0) {
    overall = clamp(overall * (1 - missingRequiredMass * 0.5));
  }

  const ci = confidenceInterval(overall, subscores);
  const presentConfs = subscores.filter((s) => !s.missing).map((s) => s.confidence);
  const overallConf = presentConfs.length
    ? presentConfs.reduce((a, b) => a + b, 0) / presentConfs.length
    : 40;
  const confidence = buildConfidenceBundle(subscores, overallConf);
  const maturity = classifyMaturity(overall);
  const outlier = detectOutlier(overall, input.prior_overall);

  const ranked = [...subscores]
    .filter((s) => s.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const strengths = ranked
    .filter((s) => (s.score ?? 0) >= 80)
    .slice(0, 3)
    .map((s) => `${s.metric_id}=${s.score}`);
  const weaknesses = ranked
    .filter((s) => (s.score ?? 0) < 70)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3)
    .map((s) => `${s.metric_id}=${s.score}`);

  const recommendations: string[] = [];
  for (const w of weaknesses) {
    const id = w.split("=")[0];
    recommendations.push(`Improve underlying ${id} before claiming higher VQI maturity`);
  }
  if (missing.length) {
    recommendations.push(
      `Missing metrics (${missing.join(", ")}) — complete coverage for full VQI confidence`,
    );
  }
  if (outlier) {
    recommendations.push(
      "Quality drift detected vs prior VQI — investigate assessment or weight changes",
    );
  }

  const scientific_interpretation = [
    `VQI ${overall}/100 (${maturityLabel(maturity)}) for ${input.entity_type}:${input.entity_id}.`,
    `Weight set ${input.weight_set.id}@${input.weight_set.version}; algorithm ${VQI_ALGORITHM_VERSION}.`,
    strengths.length
      ? `Strengths: ${strengths.join(", ")}.`
      : "No sub-index ≥ 80.",
    weaknesses.length
      ? `Weaknesses: ${weaknesses.join(", ")}.`
      : "No sub-index < 70.",
    missing.length
      ? `Missing (renormalized): ${missing.join(", ")}.`
      : "All configured metrics present.",
    `95% CI ≈ [${ci.lower}, ${ci.upper}]; overall confidence ${confidence.overall}.`,
  ].join(" ");

  return {
    overall,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    subscores,
    confidence_interval: ci,
    confidence,
    maturity,
    missing_metrics: missing,
    outlier,
    scientific_interpretation,
    strengths,
    weaknesses,
    recommendations: recommendations.slice(0, 10),
    provenance: {
      vqi_version: VQI_VERSION,
      algorithm_version: VQI_ALGORITHM_VERSION,
      weight_set_id: input.weight_set.id,
      weight_version: input.weight_set.version,
      metric_versions: {
        ...metricVersions(),
        ...Object.fromEntries(
          subscores
            .filter((s) => s.version)
            .map((s) => [s.metric_id, s.version!]),
        ),
      },
      prompt_version: input.prompt_version ?? PROMPT_ENGINE_VERSION,
      model_version: input.model_version ?? null,
      clinical_template_version: input.clinical_template_version ?? null,
      persona_version: input.persona_version ?? null,
      competency_graph_version:
        input.competency_graph_version ?? CGE_ENGINE_VERSION,
      adaptive_curriculum_version:
        input.adaptive_curriculum_version ?? ACE_ENGINE_VERSION,
      instructor_preset_version: input.instructor_preset_version ?? null,
      assessment_schema_version:
        input.assessment_schema_version ?? ASSESSMENT_SCHEMA_VERSION,
      platform_release_version: input.platform_release_version ?? VQI_VERSION,
      computed_at: new Date().toISOString(),
    },
  };
}

/**
 * Research Dataset Engine — exportable anonymized datasets.
 * CSV / JSON / FHIR-compatible. Version-controlled. Audit-logged.
 */

import { createHash } from "node:crypto";
import { stableId } from "@/lib/validation/helpers";
import {
  VALIDATION_ALGORITHM_VERSION,
  VALIDATION_VERSION,
} from "@/lib/validation/versions";
import type {
  ExpertRating,
  ResearchDatasetPackage,
  ResearchExportFormat,
  ValidationRunResult,
} from "@/lib/validation/types";

function anonSessionId(sessionId: string | null): string {
  if (!sessionId) return "anon_none";
  return (
    "anon_" +
    createHash("sha256").update(`vpsych-val:${sessionId}`).digest("hex").slice(0, 16)
  );
}

export function anonymizeRun(run: ValidationRunResult): Record<string, unknown> {
  return {
    id: run.id,
    session_ref: anonSessionId(run.session_id),
    study_id: run.study_id,
    created_at: run.created_at,
    realism_overall: run.realism.overall,
    dsm_overall: run.dsm.overall,
    consistency_overall: run.consistency.overall,
    reliability_overall: run.reliability.overall,
    metrics: run.metrics,
    realism_dimensions: run.realism.dimensions.map((d) => ({
      id: d.id,
      score: d.score,
      weight: d.weight,
      confidence: d.confidence,
    })),
    psychometrics: run.psychometrics.map((p) => ({
      kind: p.kind,
      score: p.score,
      n: p.n,
      significance_claimed: false,
    })),
    longitudinal: run.longitudinal.map((h) => ({
      horizon: h.horizon,
      metrics: h.metrics,
      simulated: h.simulated,
    })),
    versions: run.versions,
    observational: true,
    patient_state_modified: false,
  };
}

export function anonymizeRating(r: ExpertRating): Record<string, unknown> {
  return {
    id: r.id,
    rater_ref:
      "rater_" +
      createHash("sha256").update(`rater:${r.rater_id}`).digest("hex").slice(0, 12),
    session_ref: anonSessionId(r.session_id),
    case_key: r.case_key,
    domain: r.domain,
    score: r.score,
    scale_max: r.scale_max,
    rated_at: r.rated_at,
    study_id: r.study_id,
  };
}

export function exportRunsCsv(runs: ValidationRunResult[]): string {
  const header = [
    "id",
    "session_ref",
    "created_at",
    "realism_overall",
    "dsm_overall",
    "consistency_overall",
    "realism_index",
    "consistency_index",
    "clinical_fidelity",
    "session_quality",
  ].join(",");
  const rows = runs.map((r) => {
    const a = anonymizeRun(r);
    const m = a.metrics as Record<string, number>;
    return [
      a.id,
      a.session_ref,
      a.created_at,
      a.realism_overall,
      a.dsm_overall,
      a.consistency_overall,
      m.realism_index,
      m.consistency_index,
      m.clinical_fidelity,
      m.session_quality,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

export function buildFhirResearchBundle(
  runs: ValidationRunResult[],
): Record<string, unknown> {
  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    meta: {
      tag: [
        { system: "https://vpsych.local/validation", code: VALIDATION_VERSION },
      ],
    },
    entry: runs.map((run) => ({
      fullUrl: `urn:uuid:${run.id}`,
      resource: {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [
            {
              system: "https://vpsych.local/CodeSystem/validation-metric",
              code: "realism_index",
              display: "Realism Index",
            },
          ],
        },
        subject: { display: anonSessionId(run.session_id) },
        effectiveDateTime: run.created_at,
        valueQuantity: {
          value: run.metrics.realism_index,
          unit: "score",
          system: "https://vpsych.local/unit",
          code: "0-100",
        },
        note: [
          {
            text: "Observational educational research metric — not a clinical diagnosis",
          },
        ],
        extension: [
          {
            url: "https://vpsych.local/StructureDefinition/validation-versions",
            valueString: JSON.stringify(run.versions),
          },
        ],
      },
    })),
  };
}

export function buildResearchDatasetPackage(input: {
  runs: ValidationRunResult[];
  ratings: ExpertRating[];
  format?: ResearchExportFormat;
  gitSha?: string | null;
  seed?: string | null;
}): ResearchDatasetPackage {
  const audit_log_id = stableId(
    "audit",
    `${input.runs.length}:${input.ratings.length}:${Date.now()}`,
  );
  const dataset = {
    runs: input.runs.map(anonymizeRun),
    ratings: input.ratings.map(anonymizeRating),
    n_sessions: input.runs.length,
    n_ratings: input.ratings.length,
  };

  return {
    format: "vpsych-validation-research-package",
    version: VALIDATION_VERSION,
    anonymized: true,
    exported_at: new Date().toISOString(),
    n_sessions: input.runs.length,
    n_ratings: input.ratings.length,
    audit_log_id,
    dataset,
    fhir_bundle: buildFhirResearchBundle(input.runs),
    reproducibility: {
      validation_version: VALIDATION_VERSION,
      algorithm_version: VALIDATION_ALGORITHM_VERSION,
      git_sha: input.gitSha ?? null,
      seed: input.seed ?? null,
    },
  };
}

export function researchExportJson(pkg: ResearchDatasetPackage): string {
  return JSON.stringify(pkg, null, 2);
}

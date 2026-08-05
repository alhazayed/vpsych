/**
 * VQI export helpers — JSON / CSV (Excel & PDF as structured packages).
 */

import type { VPsychQualityIndex, VqiQualityCertificate } from "@/lib/vqi/types";
import type { StoredVqiRecord } from "@/lib/vqi/aggregate";

export function exportVqiJson(records: StoredVqiRecord[]): string {
  return JSON.stringify(
    {
      format: "vpsych-vqi-export",
      version: "1.0.0",
      exported_at: new Date().toISOString(),
      n: records.length,
      records,
    },
    null,
    2,
  );
}

export function exportVqiCsv(records: StoredVqiRecord[]): string {
  const header = [
    "entity_type",
    "entity_id",
    "overall",
    "maturity",
    "cfi",
    "eri",
    "avi",
    "ale",
    "rrs",
    "weight_version",
    "vqi_version",
    "computed_at",
  ];
  const rows = records.map((r) => {
    const get = (id: string) =>
      r.vqi.subscores.find((s) => s.metric_id === id)?.score ?? "";
    return [
      r.entity_type,
      r.entity_id,
      r.overall,
      r.vqi.maturity,
      get("CFI"),
      get("ERI"),
      get("AVI"),
      get("ALE"),
      get("RRS"),
      r.vqi.provenance.weight_version,
      r.vqi.provenance.vqi_version,
      r.computed_at,
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

/** Excel-compatible package (CSV sheets described in JSON for clients). */
export function exportVqiExcelPackage(records: StoredVqiRecord[]): {
  format: "vpsych-vqi-excel-package";
  sheets: Array<{ name: string; csv: string }>;
} {
  return {
    format: "vpsych-vqi-excel-package",
    sheets: [
      { name: "VQI", csv: exportVqiCsv(records) },
      {
        name: "Provenance",
        csv: [
          "entity_type,entity_id,weight_set,algorithm,prompt,schema,platform",
          ...records.map((r) =>
            [
              r.entity_type,
              r.entity_id,
              `${r.vqi.provenance.weight_set_id}@${r.vqi.provenance.weight_version}`,
              r.vqi.provenance.algorithm_version,
              r.vqi.provenance.prompt_version,
              r.vqi.provenance.assessment_schema_version,
              r.vqi.provenance.platform_release_version,
            ].join(","),
          ),
        ].join("\n"),
      },
    ],
  };
}

/** PDF report payload (render client-side / print). */
export function exportVqiPdfPayload(
  vqi: VPsychQualityIndex,
  certificate: VqiQualityCertificate,
): Record<string, unknown> {
  return {
    format: "vpsych-vqi-pdf-payload",
    title: "VPsych Quality Index Report",
    certificate,
    overall: vqi.overall,
    maturity: vqi.maturity,
    confidence: vqi.confidence,
    subscores: vqi.subscores,
    interpretation: vqi.scientific_interpretation,
    strengths: vqi.strengths,
    weaknesses: vqi.weaknesses,
    recommendations: vqi.recommendations,
    provenance: vqi.provenance,
  };
}

export function exportResearchDataset(records: StoredVqiRecord[]): string {
  return JSON.stringify(
    {
      format: "vpsych-vqi-research-dataset",
      version: "1.0.0",
      anonymized: true,
      note: "Entity ids are synthetic corpus keys; strip institution PII before publication",
      records: records.map((r) => ({
        entity_type: r.entity_type,
        entity_key: r.entity_id,
        overall: r.overall,
        maturity: r.vqi.maturity,
        subscores: r.vqi.subscores.map((s) => ({
          metric_id: s.metric_id,
          score: s.score,
          weight: s.weight,
          confidence: s.confidence,
        })),
        provenance: {
          vqi_version: r.vqi.provenance.vqi_version,
          weight_version: r.vqi.provenance.weight_version,
          algorithm_version: r.vqi.provenance.algorithm_version,
          metric_versions: r.vqi.provenance.metric_versions,
        },
      })),
    },
    null,
    2,
  );
}

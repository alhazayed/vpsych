/**
 * VQI certificate + maturity classification.
 */

import { randomUUID } from "crypto";
import type {
  VPsychQualityIndex,
  VqiQualityCertificate,
} from "@/lib/vqi/types";
import { maturityLabel } from "@/lib/vqi/engine";

export function issueQualityCertificate(
  vqi: VPsychQualityIndex,
): VqiQualityCertificate {
  const rrs = vqi.subscores.find((s) => s.metric_id === "RRS")?.score;
  const cfi = vqi.subscores.find((s) => s.metric_id === "CFI")?.score;
  const eri = vqi.subscores.find((s) => s.metric_id === "ERI")?.score;

  return {
    certificate_id: `VQI-CERT-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    issued_at: new Date().toISOString(),
    overall_vqi: vqi.overall,
    maturity: vqi.maturity,
    confidence: vqi.confidence,
    sub_indices: vqi.subscores.map((s) => ({
      metric_id: s.metric_id,
      score: s.score,
      weight: s.weight,
    })),
    platform_readiness: `${maturityLabel(vqi.maturity)} — platform VQI ${vqi.overall}/100`,
    institution_readiness:
      vqi.overall >= 75
        ? "Suitable for supervised institutional pilots with human co-examination"
        : "Not yet ready for institutional pilot — remediate sub-indices below 70",
    research_readiness:
      rrs != null && rrs >= 70
        ? "Research-ready with disclosed gaps (see RRS)"
        : "Research export/anonymization gaps limit publication datasets",
    scientific_interpretation: [
      vqi.scientific_interpretation,
      cfi != null ? `Clinical confidence proxy via CFI=${cfi}.` : "",
      eri != null ? `Educational confidence proxy via ERI=${eri}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    provenance: vqi.provenance,
  };
}

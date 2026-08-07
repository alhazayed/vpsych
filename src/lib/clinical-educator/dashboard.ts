/**
 * Clinical Educator dashboard aggregates (admin cohort view).
 */

import {
  CLINICAL_EDUCATOR_RUBRIC,
  CLINICAL_EDUCATOR_VERSION,
  localizeDimensionLabel,
} from "@/lib/clinical-educator/rubrics";
import type {
  ClinicalEducatorDashboard,
  ClinicalEducatorDimensionId,
  ClinicalEducatorReport,
} from "@/lib/clinical-educator/types";
import { CLINICAL_EDUCATOR_DIMENSION_IDS } from "@/lib/clinical-educator/types";

export type ClinicalEducatorStoredRow = {
  session_id: string;
  therapist_name?: string | null;
  patient_name?: string | null;
  language?: string | null;
  created_at: string;
  clinical_educator?: ClinicalEducatorReport | null;
  /** Fallback when clinical_educator blob missing — map items → percents. */
  legacy_items?: Array<{ id: string; score: number; max: number }>;
  legacy_overall?: number | null;
};

function percentFromLegacy(
  items: Array<{ id: string; score: number; max: number }>,
  id: string,
): number | null {
  const found = items.find((i) => i.id === id);
  if (!found || !found.max) return null;
  return Math.round((found.score / found.max) * 100);
}

export function buildClinicalEducatorDashboard(
  rows: ClinicalEducatorStoredRow[],
  language: "en" | "ar" = "en",
): ClinicalEducatorDashboard {
  const sums = Object.fromEntries(
    CLINICAL_EDUCATOR_DIMENSION_IDS.map((id) => [id, { sum: 0, n: 0 }]),
  ) as Record<ClinicalEducatorDimensionId, { sum: number; n: number }>;

  const recent = rows.slice(0, 40).map((row) => {
    const dims =
      row.clinical_educator?.dimensions?.map((d) => ({
        id: d.id,
        percent: d.percent,
      })) ??
      CLINICAL_EDUCATOR_DIMENSION_IDS.map((id) => {
        const pct = row.legacy_items
          ? percentFromLegacy(row.legacy_items, id)
          : null;
        return { id, percent: pct ?? 0 };
      });

    for (const d of dims) {
      if (
        (CLINICAL_EDUCATOR_DIMENSION_IDS as readonly string[]).includes(d.id) &&
        d.percent > 0
      ) {
        const key = d.id as ClinicalEducatorDimensionId;
        sums[key].sum += d.percent;
        sums[key].n += 1;
      }
    }

    return {
      session_id: row.session_id,
      therapist_name: row.therapist_name ?? null,
      patient_name: row.patient_name ?? null,
      language: row.language ?? null,
      created_at: row.created_at,
      composite:
        row.clinical_educator?.composite ?? row.legacy_overall ?? null,
      dimensions: dims,
    };
  });

  // Also fold non-recent rows into averages
  for (const row of rows.slice(40)) {
    const dims =
      row.clinical_educator?.dimensions ??
      CLINICAL_EDUCATOR_DIMENSION_IDS.map((id) => ({
        id,
        percent: row.legacy_items
          ? percentFromLegacy(row.legacy_items, id) ?? 0
          : 0,
      }));
    for (const d of dims) {
      if (
        (CLINICAL_EDUCATOR_DIMENSION_IDS as readonly string[]).includes(d.id) &&
        d.percent > 0
      ) {
        const key = d.id as ClinicalEducatorDimensionId;
        sums[key].sum += d.percent;
        sums[key].n += 1;
      }
    }
  }

  const dimension_averages = CLINICAL_EDUCATOR_DIMENSION_IDS.map((id) => {
    const { sum, n } = sums[id];
    return {
      id,
      label: localizeDimensionLabel(id, language),
      average_percent: n ? Math.round(sum / n) : 0,
      n,
    };
  });

  const ranked = [...dimension_averages].sort(
    (a, b) => a.average_percent - b.average_percent,
  );
  const weakest_dimensions = ranked
    .filter((d) => d.n > 0)
    .slice(0, 3)
    .map((d) => d.id);
  const strongest_dimensions = [...ranked]
    .filter((d) => d.n > 0)
    .reverse()
    .slice(0, 3)
    .map((d) => d.id);

  return {
    version: CLINICAL_EDUCATOR_VERSION,
    n_reports: rows.length,
    dimension_averages,
    weakest_dimensions,
    strongest_dimensions,
    recent,
    disclaimer:
      language === "ar"
        ? "لوحة المعلّم السريري تكوينية فقط — لا تُستخدم لاعتماد عالي المخاطر."
        : "Clinical Educator dashboard is formative only — do not use for high-stakes credentialing.",
  };
}

export function clinicalEducatorRubricCatalog(language: "en" | "ar") {
  return CLINICAL_EDUCATOR_RUBRIC.map((r) => ({
    id: r.id,
    label: language === "ar" ? r.label_ar : r.label_en,
    weight: r.weight,
    max: r.max,
    guidance: language === "ar" ? r.guidance_ar : r.guidance_en,
    anchors: r.anchors.map((a) => ({
      score: a.score,
      label: language === "ar" ? a.label_ar : a.label_en,
      description: language === "ar" ? a.description_ar : a.description_en,
    })),
  }));
}

/**
 * Timelines, benchmarks, dashboard aggregation, exports.
 */

import type {
  QualityBenchmarkRow,
  QualityLedgerDashboard,
  QualityLedgerEntry,
  QualityTimelinePoint,
} from "@/lib/quality-ledger/types";
import {
  QUALITY_ALGORITHM_VERSION,
  QUALITY_LEDGER_VERSION,
} from "@/lib/quality-ledger/types";

function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function buildTimeline(
  entries: QualityLedgerEntry[],
  filter?: {
    learner_id?: string;
    instructor_id?: string;
    institution_id?: string;
    diagnosis_slug?: string;
    clinical_template_id?: string;
    ai_model?: string;
    platform_release_version?: string;
  },
): QualityTimelinePoint[] {
  let rows = entries;
  if (filter?.learner_id)
    rows = rows.filter((r) => r.learner_id === filter.learner_id);
  if (filter?.instructor_id)
    rows = rows.filter((r) => r.instructor_id === filter.instructor_id);
  if (filter?.institution_id)
    rows = rows.filter((r) => r.institution_id === filter.institution_id);
  if (filter?.diagnosis_slug)
    rows = rows.filter((r) => r.diagnosis_slug === filter.diagnosis_slug);
  if (filter?.clinical_template_id)
    rows = rows.filter(
      (r) => r.clinical_template_id === filter.clinical_template_id,
    );
  if (filter?.ai_model) rows = rows.filter((r) => r.ai_model === filter.ai_model);
  if (filter?.platform_release_version)
    rows = rows.filter(
      (r) => r.platform_release_version === filter.platform_release_version,
    );
  return rows
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((r) => ({
      at: r.created_at,
      ledger_id: r.id,
      event_type: r.event_type,
      vqi: r.vqi,
      cfi: r.cfi,
      eri: r.eri,
      avi: r.avi,
      session_id: r.session_id,
      diagnosis_slug: r.diagnosis_slug,
    }));
}

export function buildBenchmarks(
  current: QualityLedgerEntry,
  corpus: QualityLedgerEntry[],
): QualityBenchmarkRow[] {
  const withVqi = corpus.filter((r) => r.vqi != null);
  const platformAvg = mean(withVqi.map((r) => r.vqi!));
  const sameDx = withVqi.filter(
    (r) => r.diagnosis_slug && r.diagnosis_slug === current.diagnosis_slug,
  );
  const sameLang = withVqi.filter(
    (r) => r.language && r.language === current.language,
  );
  const sameModel = withVqi.filter(
    (r) => r.ai_model && r.ai_model === current.ai_model,
  );
  const prior = withVqi
    .filter(
      (r) =>
        r.learner_id === current.learner_id &&
        r.created_at < current.created_at,
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];

  const mk = (
    label: string,
    reference: number | null,
  ): QualityBenchmarkRow | null => {
    if (current.vqi == null || reference == null || !Number.isFinite(reference))
      return null;
    const delta = Math.round((current.vqi - reference) * 10) / 10;
    return {
      label,
      reference: Math.round(reference * 10) / 10,
      current: current.vqi,
      delta,
      meaningful: Math.abs(delta) >= 5,
      method: "abs_diff_gt_5",
    };
  };

  return [
    mk("Platform average", withVqi.length ? platformAvg : null),
    mk(
      "Disorder average",
      sameDx.length ? mean(sameDx.map((r) => r.vqi!)) : null,
    ),
    mk(
      "Language average",
      sameLang.length ? mean(sameLang.map((r) => r.vqi!)) : null,
    ),
    mk(
      "AI model average",
      sameModel.length ? mean(sameModel.map((r) => r.vqi!)) : null,
    ),
    mk("Previous learner assessment", prior?.vqi ?? null),
  ].filter(Boolean) as QualityBenchmarkRow[];
}

function groupMean(
  entries: QualityLedgerEntry[],
  keyFn: (e: QualityLedgerEntry) => string | null,
): Array<{ key: string; n: number; mean_vqi: number }> {
  const map = new Map<string, number[]>();
  for (const e of entries) {
    const k = keyFn(e);
    if (!k || e.vqi == null) continue;
    const arr = map.get(k) ?? [];
    arr.push(e.vqi);
    map.set(k, arr);
  }
  return [...map.entries()]
    .map(([key, xs]) => ({
      key,
      n: xs.length,
      mean_vqi: Math.round(mean(xs) * 10) / 10,
    }))
    .sort((a, b) => b.n - a.n);
}

export function buildQualityLedgerDashboard(
  entries: QualityLedgerEntry[],
): QualityLedgerDashboard {
  const vqis = entries.filter((e) => e.vqi != null).map((e) => e.vqi!);
  const byEvent = new Map<string, number>();
  for (const e of entries) {
    byEvent.set(e.event_type, (byEvent.get(e.event_type) ?? 0) + 1);
  }

  const dayBuckets = new Map<string, number[]>();
  for (const e of entries) {
    if (e.vqi == null) continue;
    const day = e.created_at.slice(0, 10);
    const arr = dayBuckets.get(day) ?? [];
    arr.push(e.vqi);
    dayBuckets.set(day, arr);
  }
  const trends = [...dayBuckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, xs]) => ({
      at,
      mean_vqi: Math.round(mean(xs) * 10) / 10,
      n: xs.length,
    }));

  const recommendations: string[] = [];
  const low = entries.filter((e) => e.vqi != null && e.vqi < 75);
  if (low.length)
    recommendations.push(
      `${low.length} ledger entries below Pilot Ready (VQI < 75) — audit weak sub-indices`,
    );
  const fallbacks = entries.filter((e) => e.fallback_used);
  if (fallbacks.length)
    recommendations.push(
      `${fallbacks.length} assessments used heuristic fallback — disclose in research exports`,
    );
  if (!entries.length)
    recommendations.push(
      "No ledger entries yet — complete an assessment to seal the first immutable record",
    );

  return {
    ledger_version: QUALITY_LEDGER_VERSION,
    algorithm_version: QUALITY_ALGORITHM_VERSION,
    n: entries.length,
    mean_vqi: vqis.length ? Math.round(mean(vqis) * 10) / 10 : null,
    immutable: true,
    by_event: [...byEvent.entries()].map(([event_type, n]) => ({
      event_type,
      n,
    })),
    by_diagnosis: groupMean(entries, (e) => e.diagnosis_slug),
    by_model: groupMean(entries, (e) => e.ai_model),
    by_language: groupMean(entries, (e) => e.language),
    by_release: groupMean(entries, (e) => e.platform_release_version),
    recent: entries
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 25)
      .map((e) => ({
        id: e.id,
        created_at: e.created_at,
        session_id: e.session_id,
        diagnosis_slug: e.diagnosis_slug,
        vqi: e.vqi,
        event_type: e.event_type,
        content_hash: e.content_hash,
      })),
    trends,
    recommendations,
  };
}

export function exportLedgerJson(entries: QualityLedgerEntry[]): string {
  return JSON.stringify(
    {
      format: "vpsych-quality-ledger-export",
      version: QUALITY_LEDGER_VERSION,
      exported_at: new Date().toISOString(),
      n: entries.length,
      immutable: true,
      records: entries,
    },
    null,
    2,
  );
}

export function exportLedgerCsv(entries: QualityLedgerEntry[]): string {
  const header = [
    "id",
    "created_at",
    "event_type",
    "session_id",
    "learner_id",
    "diagnosis_slug",
    "language",
    "ai_model",
    "fallback_used",
    "vqi",
    "cfi",
    "eri",
    "avi",
    "ale",
    "rrs",
    "overall_confidence",
    "content_hash",
    "quality_algorithm_version",
    "platform_release_version",
    "git_commit_sha",
  ];
  const rows = entries.map((e) =>
    [
      e.id,
      e.created_at,
      e.event_type,
      e.session_id ?? "",
      e.learner_id ?? "",
      e.diagnosis_slug ?? "",
      e.language ?? "",
      e.ai_model ?? "",
      e.fallback_used,
      e.vqi ?? "",
      e.cfi ?? "",
      e.eri ?? "",
      e.avi ?? "",
      e.ale ?? "",
      e.rrs ?? "",
      e.overall_confidence ?? "",
      e.content_hash,
      e.quality_algorithm_version,
      e.platform_release_version ?? "",
      e.git_commit_sha ?? "",
    ].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Anonymized research dataset — strips learner/instructor UUIDs. */
export function exportAnonymousResearchDataset(
  entries: QualityLedgerEntry[],
): string {
  const records = entries.map((e, i) => ({
    anon_id: `L${String(i + 1).padStart(5, "0")}`,
    event_type: e.event_type,
    diagnosis_slug: e.diagnosis_slug,
    language: e.language,
    locale: e.locale,
    ai_provider: e.ai_provider,
    ai_model: e.ai_model_version ?? e.ai_model,
    fallback_used: e.fallback_used,
    assessment_duration_sec: e.assessment_duration_sec,
    conversation_turns: e.conversation_turns,
    word_count: e.word_count,
    vqi: e.vqi,
    cfi: e.cfi,
    eri: e.eri,
    avi: e.avi,
    ale: e.ale,
    rrs: e.rrs,
    hcfi: e.hcfi,
    pmfi: e.pmfi,
    scientific_confidence: e.scientific_confidence,
    educational_confidence: e.educational_confidence,
    clinical_confidence: e.clinical_confidence,
    technical_confidence: e.technical_confidence,
    overall_confidence: e.overall_confidence,
    quality_algorithm_version: e.quality_algorithm_version,
    metric_algorithm_version: e.metric_algorithm_version,
    platform_release_version: e.platform_release_version,
    content_hash: e.content_hash,
    created_at_day: e.created_at.slice(0, 10),
  }));
  return JSON.stringify(
    {
      format: "vpsych-quality-ledger-anonymous",
      version: QUALITY_LEDGER_VERSION,
      phi_stripped: true,
      n: records.length,
      records,
    },
    null,
    2,
  );
}

export function exportLedgerExcelPackage(entries: QualityLedgerEntry[]): {
  format: "vpsych-quality-ledger-excel-package";
  sheets: Array<{ name: string; csv: string }>;
} {
  return {
    format: "vpsych-quality-ledger-excel-package",
    sheets: [
      { name: "Ledger", csv: exportLedgerCsv(entries) },
      {
        name: "Anonymous",
        csv: [
          "anon_id,diagnosis_slug,language,vqi,cfi,eri,avi,ale,rrs",
          ...entries.map((e, i) =>
            [
              `L${String(i + 1).padStart(5, "0")}`,
              e.diagnosis_slug ?? "",
              e.language ?? "",
              e.vqi ?? "",
              e.cfi ?? "",
              e.eri ?? "",
              e.avi ?? "",
              e.ale ?? "",
              e.rrs ?? "",
            ].join(","),
          ),
        ].join("\n"),
      },
    ],
  };
}

/** Lightweight FHIR-inspired research bundle (Observation resources). */
export function exportFhirCompatibleBundle(entries: QualityLedgerEntry[]): {
  resourceType: "Bundle";
  type: "collection";
  meta: { profile: string[] };
  entry: Array<{ resource: Record<string, unknown> }>;
} {
  return {
    resourceType: "Bundle",
    type: "collection",
    meta: {
      profile: ["https://vpsych.local/fhir/QualityLedgerBundle"],
    },
    entry: entries.flatMap((e) => {
      const metrics: Array<[string, number | null]> = [
        ["VQI", e.vqi],
        ["CFI", e.cfi],
        ["ERI", e.eri],
        ["AVI", e.avi],
        ["ALE", e.ale],
        ["RRS", e.rrs],
      ];
      return metrics
        .filter(([, v]) => v != null)
        .map(([code, value]) => ({
          resource: {
            resourceType: "Observation",
            id: `${e.id}-${code}`,
            status: "final",
            code: {
              coding: [
                {
                  system: "https://vpsych.local/CodeSystem/quality-metric",
                  code,
                },
              ],
            },
            effectiveDateTime: e.created_at,
            valueQuantity: {
              value,
              unit: "score",
              system: "https://vpsych.local",
              code: "0-100",
            },
            extension: [
              {
                url: "https://vpsych.local/fhir/StructureDefinition/content-hash",
                valueString: e.content_hash,
              },
              {
                url: "https://vpsych.local/fhir/StructureDefinition/diagnosis-slug",
                valueString: e.diagnosis_slug,
              },
            ],
          },
        }));
    }),
  };
}

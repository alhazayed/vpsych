/**
 * Multi-ledger dashboards, timelines, exports, replay.
 */

import type { EducationalEvent } from "@/lib/ledgers/education";
import type { OperationalEvent } from "@/lib/ledgers/operational";
import type { LedgerCorrelation } from "@/lib/ledgers/shared";
import {
  EDUCATIONAL_LEDGER_VERSION,
  MULTI_LEDGER_VERSION,
  OPERATIONAL_LEDGER_VERSION,
  SCIENTIFIC_LEDGER_VERSION,
} from "@/lib/ledgers/shared";
import type { QualityLedgerEntry } from "@/lib/quality-ledger";

export type MultiLedgerDashboard = {
  platform_version: string;
  layers: {
    operational: { version: string; n: number; by_category: Array<{ key: string; n: number }> };
    education: { version: string; n: number; by_type: Array<{ key: string; n: number }> };
    quality: { version: string; n: number; mean_vqi: number | null };
  };
  correlations: number;
  recent_operational: OperationalEvent[];
  recent_educational: EducationalEvent[];
  recent_quality: Array<{
    id: string;
    session_id: string | null;
    vqi: number | null;
    created_at: string;
  }>;
  recommendations: string[];
};

function countBy<T>(rows: T[], keyFn: (r: T) => string | null) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, n]) => ({ key, n }))
    .sort((a, b) => b.n - a.n);
}

export function buildMultiLedgerDashboard(input: {
  operational: OperationalEvent[];
  educational: EducationalEvent[];
  quality: QualityLedgerEntry[];
  correlations: LedgerCorrelation[];
}): MultiLedgerDashboard {
  const vqis = input.quality.filter((q) => q.vqi != null).map((q) => q.vqi!);
  const mean_vqi = vqis.length
    ? Math.round((vqis.reduce((a, b) => a + b, 0) / vqis.length) * 10) / 10
    : null;

  const recommendations: string[] = [];
  if (!input.operational.length)
    recommendations.push("Operational ledger empty — wire security/API events");
  if (!input.educational.length)
    recommendations.push("Educational ledger empty — seal assessment start/complete");
  if (!input.quality.length)
    recommendations.push("Scientific ledger empty — complete an assessment");
  const denied = input.operational.filter((e) => e.outcome === "denied");
  if (denied.length)
    recommendations.push(`${denied.length} authorization denials in operational trail`);

  return {
    platform_version: MULTI_LEDGER_VERSION,
    layers: {
      operational: {
        version: OPERATIONAL_LEDGER_VERSION,
        n: input.operational.length,
        by_category: countBy(input.operational, (e) => e.category),
      },
      education: {
        version: EDUCATIONAL_LEDGER_VERSION,
        n: input.educational.length,
        by_type: countBy(input.educational, (e) => e.event_type),
      },
      quality: {
        version: SCIENTIFIC_LEDGER_VERSION,
        n: input.quality.length,
        mean_vqi,
      },
    },
    correlations: input.correlations.length,
    recent_operational: input.operational.slice(0, 15),
    recent_educational: input.educational.slice(0, 15),
    recent_quality: input.quality.slice(0, 15).map((q) => ({
      id: q.id,
      session_id: q.session_id,
      vqi: q.vqi,
      created_at: q.created_at,
    })),
    recommendations,
  };
}

/** Unified replay timeline across all three ledgers for a session. */
export function replaySessionTimeline(input: {
  session_id: string;
  operational: OperationalEvent[];
  educational: EducationalEvent[];
  quality: QualityLedgerEntry[];
  correlations: LedgerCorrelation[];
}): Array<{
  at: string;
  layer: "operational" | "education" | "quality" | "correlation";
  type: string;
  id: string;
  summary: string;
}> {
  const sid = input.session_id;
  const corrIds = new Set(
    input.correlations
      .filter((c) => c.session_id === sid)
      .map((c) => c.correlation_id),
  );

  const points: Array<{
    at: string;
    layer: "operational" | "education" | "quality" | "correlation";
    type: string;
    id: string;
    summary: string;
  }> = [];

  for (const e of input.operational) {
    if (
      e.resource_id === sid ||
      (e.correlation_id && corrIds.has(e.correlation_id))
    ) {
      points.push({
        at: e.created_at,
        layer: "operational",
        type: e.event_type,
        id: e.id,
        summary: `${e.category}/${e.outcome} · ${e.severity}`,
      });
    }
  }
  for (const e of input.educational) {
    if (e.session_id === sid) {
      points.push({
        at: e.created_at,
        layer: "education",
        type: e.event_type,
        id: e.id,
        summary: e.outcome ?? e.diagnosis_slug ?? e.event_type,
      });
    }
  }
  for (const q of input.quality) {
    if (q.session_id === sid) {
      points.push({
        at: q.created_at,
        layer: "quality",
        type: q.event_type,
        id: q.id,
        summary: `VQI=${q.vqi ?? "n/a"} hash=${q.content_hash.slice(0, 8)}`,
      });
    }
  }
  for (const c of input.correlations) {
    if (c.session_id === sid) {
      points.push({
        at: c.created_at,
        layer: "correlation",
        type: "cross_ledger_link",
        id: c.id,
        summary: c.correlation_id,
      });
    }
  }

  return points.sort((a, b) => (a.at < b.at ? -1 : 1));
}

export function exportMultiLedgerJson(input: {
  operational: OperationalEvent[];
  educational: EducationalEvent[];
  quality: QualityLedgerEntry[];
  correlations: LedgerCorrelation[];
}): string {
  return JSON.stringify(
    {
      format: "vpsych-multi-ledger-export",
      version: MULTI_LEDGER_VERSION,
      exported_at: new Date().toISOString(),
      layers: {
        operational: input.operational,
        education: input.educational,
        quality: input.quality.map((q) => ({
          id: q.id,
          session_id: q.session_id,
          vqi: q.vqi,
          cfi: q.cfi,
          eri: q.eri,
          avi: q.avi,
          ale: q.ale,
          rrs: q.rrs,
          content_hash: q.content_hash,
          created_at: q.created_at,
        })),
      },
      correlations: input.correlations,
    },
    null,
    2,
  );
}

export function exportMultiLedgerCsv(input: {
  operational: OperationalEvent[];
  educational: EducationalEvent[];
  quality: QualityLedgerEntry[];
}): string {
  const rows = [
    "layer,id,created_at,type,session_or_resource,outcome_or_vqi,content_hash",
    ...input.operational.map(
      (e) =>
        `operational,${e.id},${e.created_at},${e.event_type},${e.resource_id ?? ""},${e.outcome},${e.content_hash}`,
    ),
    ...input.educational.map(
      (e) =>
        `education,${e.id},${e.created_at},${e.event_type},${e.session_id ?? ""},${e.outcome ?? ""},${e.content_hash}`,
    ),
    ...input.quality.map(
      (q) =>
        `quality,${q.id},${q.created_at},${q.event_type},${q.session_id ?? ""},${q.vqi ?? ""},${q.content_hash}`,
    ),
  ];
  return rows.join("\n");
}

export function exportAnonymousMultiLedger(
  educational: EducationalEvent[],
  quality: QualityLedgerEntry[],
): string {
  return JSON.stringify(
    {
      format: "vpsych-multi-ledger-anonymous",
      version: MULTI_LEDGER_VERSION,
      phi_stripped: true,
      education: educational.map((e, i) => ({
        anon_id: `E${String(i + 1).padStart(5, "0")}`,
        event_type: e.event_type,
        diagnosis_slug: e.diagnosis_slug,
        difficulty: e.difficulty,
        language: e.language,
        duration_sec: e.duration_sec,
        outcome: e.outcome,
        created_at_day: e.created_at.slice(0, 10),
      })),
      quality: quality.map((q, i) => ({
        anon_id: `Q${String(i + 1).padStart(5, "0")}`,
        diagnosis_slug: q.diagnosis_slug,
        language: q.language,
        vqi: q.vqi,
        cfi: q.cfi,
        eri: q.eri,
        avi: q.avi,
        ale: q.ale,
        rrs: q.rrs,
        created_at_day: q.created_at.slice(0, 10),
      })),
    },
    null,
    2,
  );
}

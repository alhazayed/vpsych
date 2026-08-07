/**
 * Phase 14 — Longitudinal success-metric trends (PHI-free).
 */

export type TrendPoint = { t: string; v: number };

export type SuccessTrendSeries = {
  id: string;
  label: string;
  unit?: string;
  points: TrendPoint[];
  direction: "up" | "down" | "flat" | "insufficient";
  delta: number | null;
};

export type SuccessTrendsBundle = {
  generated_at: string;
  series: SuccessTrendSeries[];
  notes: string[];
};

export type TrendSample = {
  t: string;
  institution_adoption?: number;
  resident_retention?: number;
  faculty_adoption?: number;
  session_completion?: number;
  assessment_reliability?: number;
  supervisor_consistency?: number;
  clinical_realism?: number;
  platform_availability?: number;
  support_volume?: number;
  critical_incident_rate?: number;
  security_events?: number;
  research_participation?: number;
  certification_success?: number;
};

const SERIES: Array<{
  id: keyof Omit<TrendSample, "t">;
  label: string;
  unit?: string;
  /** When true, lower is better for "healthy" direction semantics. */
  invert?: boolean;
}> = [
  { id: "institution_adoption", label: "Institution adoption", unit: "count" },
  { id: "resident_retention", label: "Resident retention", unit: "%" },
  { id: "faculty_adoption", label: "Faculty adoption", unit: "%" },
  { id: "session_completion", label: "Session completion", unit: "%" },
  {
    id: "assessment_reliability",
    label: "Assessment reliability",
    unit: "%",
  },
  {
    id: "supervisor_consistency",
    label: "Supervisor consistency",
    unit: "%",
  },
  { id: "clinical_realism", label: "Clinical realism", unit: "%" },
  {
    id: "platform_availability",
    label: "Platform availability",
    unit: "%",
  },
  { id: "support_volume", label: "Support volume", unit: "count", invert: true },
  {
    id: "critical_incident_rate",
    label: "Critical incident rate",
    unit: "%",
    invert: true,
  },
  {
    id: "security_events",
    label: "Security events",
    unit: "count",
    invert: true,
  },
  {
    id: "research_participation",
    label: "Research participation",
    unit: "sites",
  },
  {
    id: "certification_success",
    label: "Certification success",
    unit: "%",
  },
];

export function buildSuccessTrends(
  samples: TrendSample[] = [],
): SuccessTrendsBundle {
  const ordered = [...samples].sort((a, b) => a.t.localeCompare(b.t));
  const series: SuccessTrendSeries[] = SERIES.map((meta) => {
    const points: TrendPoint[] = ordered
      .map((s) => {
        const raw = s[meta.id];
        return typeof raw === "number" && Number.isFinite(raw)
          ? { t: s.t, v: raw }
          : null;
      })
      .filter((p): p is TrendPoint => p !== null);

    let direction: SuccessTrendSeries["direction"] = "insufficient";
    let delta: number | null = null;
    if (points.length >= 2) {
      const first = points[0]!.v;
      const last = points[points.length - 1]!.v;
      delta = Math.round((last - first) * 1000) / 1000;
      if (Math.abs(delta) < 1e-9) direction = "flat";
      else if (delta > 0) direction = meta.invert ? "down" : "up";
      else direction = meta.invert ? "up" : "down";
    }

    return {
      id: String(meta.id),
      label: meta.label,
      unit: meta.unit,
      points,
      direction,
      delta,
    };
  });

  return {
    generated_at: new Date().toISOString(),
    series,
    notes: [
      "Trends are observational program metrics — not validated clinical instruments.",
      "Insufficient points until weekly samples accumulate during the pilot.",
    ],
  };
}

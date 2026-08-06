import type { LongitudinalMeasureRow } from "@/lib/cvl/types";
import { mean } from "@/lib/cvl/statistics";

export function validateLongitudinalMeasure(
  raw: unknown,
): { ok: true; row: LongitudinalMeasureRow } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid payload" };
  }
  const body = raw as Partial<LongitudinalMeasureRow>;
  if (!body.study_id || !body.case_instance_id) {
    return { ok: false, error: "study_id and case_instance_id required" };
  }
  const idx = Number(body.session_index);
  if (!Number.isInteger(idx) || idx < 1 || idx > 50) {
    return { ok: false, error: "session_index must be integer 1–50" };
  }
  return {
    ok: true,
    row: {
      study_id: body.study_id,
      case_instance_id: body.case_instance_id,
      session_index: idx,
      memory: numOrNull(body.memory),
      life_events: numOrNull(body.life_events),
      alliance: numOrNull(body.alliance),
      treatment_response: numOrNull(body.treatment_response),
      trust: numOrNull(body.trust),
      disclosure: numOrNull(body.disclosure),
      clinical_progression: numOrNull(body.clinical_progression),
      recorded_at: body.recorded_at ?? new Date().toISOString(),
    },
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function analyzeLongitudinal(rows: LongitudinalMeasureRow[]): {
  n_sessions: number;
  n_cases: number;
  trajectory: Array<{ session_index: number; alliance: number | null; trust: number | null }>;
  insufficient_data: boolean;
  notes: string[];
} {
  const cases = new Set(rows.map((r) => r.case_instance_id));
  const bySession = new Map<number, LongitudinalMeasureRow[]>();
  for (const r of rows) {
    const list = bySession.get(r.session_index) ?? [];
    list.push(r);
    bySession.set(r.session_index, list);
  }
  const trajectory = [...bySession.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([session_index, list]) => ({
      session_index,
      alliance: mean(
        list.map((x) => x.alliance).filter((x): x is number => x != null),
      ),
      trust: mean(
        list.map((x) => x.trust).filter((x): x is number => x != null),
      ),
    }));

  const insufficient = cases.size < 2 || rows.length < 4;
  return {
    n_sessions: rows.length,
    n_cases: cases.size,
    trajectory,
    insufficient_data: insufficient,
    notes: [
      insufficient
        ? "Need ≥2 cases and ≥4 session measures for longitudinal claims."
        : "Trajectory computed from submitted measures only.",
    ],
  };
}

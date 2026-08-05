import type { PatientMindFidelityIndex } from "@/lib/pmfi/types";
import { PMFI_VERSION } from "@/lib/pmfi/weights";

export type StoredPmfiRecord = {
  overall: number;
  disorder_slug: string;
  computed_at: string;
  pmfi: PatientMindFidelityIndex;
};

const HISTORY: StoredPmfiRecord[] = [];

export function recordPmfiHistory(record: StoredPmfiRecord): void {
  HISTORY.push(record);
  if (HISTORY.length > 5000) HISTORY.splice(0, HISTORY.length - 5000);
}

export function listPmfiHistory(limit = 500): StoredPmfiRecord[] {
  return HISTORY.slice(-limit);
}

export function clearPmfiHistory(): void {
  HISTORY.length = 0;
}

export function buildPmfiDashboard(records: StoredPmfiRecord[]) {
  const overalls = records.map((r) => r.overall);
  const mean =
    overalls.length === 0
      ? 0
      : overalls.reduce((a, b) => a + b, 0) / overalls.length;
  return {
    pmfi_version: PMFI_VERSION,
    n: records.length,
    mean_overall: Math.round(mean * 10) / 10,
    recent: records.slice(-20),
    recommendations:
      mean < 75
        ? [
            "Mean PMFI < 75 — strengthen expression wiring, disclosure continuity, and longitudinal life events.",
          ]
        : [],
  };
}

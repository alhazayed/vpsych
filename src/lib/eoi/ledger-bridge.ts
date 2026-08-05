/**
 * EOI signals stay off the defect Quality Ledger path.
 * Separate ring buffer for educational innovation trends.
 */

export type EoiLedgerSignal = {
  opportunity_id: string;
  opportunity_type: string;
  educational_impact: number;
  disorder_slug: string | null;
  competencies: string[];
  release_version: string | null;
  is_defect: false;
};

const MEMORY: EoiLedgerSignal[] = [];

export function recordEoiLedgerSignal(signal: EoiLedgerSignal): {
  ok: boolean;
  ref: string;
} {
  MEMORY.push({ ...signal, is_defect: false });
  if (MEMORY.length > 5000) MEMORY.splice(0, MEMORY.length - 5000);
  return { ok: true, ref: `eoi-mem:${signal.opportunity_id}` };
}

export function listEoiLedgerSignals(limit = 500): EoiLedgerSignal[] {
  return MEMORY.slice(-limit);
}

/**
 * Soft Quality Ledger / scientific index integration.
 * Never throws — CQI must not block feedback capture when ledger is absent.
 */

export type CqiLedgerSignal = {
  flag_id: string;
  category: string;
  severity: string;
  disorder_slug: string | null;
  language: string | null;
  release_version: string | null;
  prompt_version: string | null;
  scores?: Record<string, number | undefined>;
};

/**
 * Record a lightweight CQI signal for future Quality Ledger / VQI trends.
 * On main (no quality-ledger package) this is an in-memory ring buffer only.
 */
const MEMORY: CqiLedgerSignal[] = [];

export function recordCqiLedgerSignal(signal: CqiLedgerSignal): {
  ok: boolean;
  mode: "memory" | "ledger";
  ref: string | null;
} {
  try {
    MEMORY.push(signal);
    if (MEMORY.length > 5000) MEMORY.splice(0, MEMORY.length - 5000);
    return {
      ok: true,
      mode: "memory",
      ref: `cqi-mem:${signal.flag_id}`,
    };
  } catch {
    return { ok: false, mode: "memory", ref: null };
  }
}

export function listCqiLedgerSignals(limit = 500): CqiLedgerSignal[] {
  return MEMORY.slice(-limit);
}

/** Trend helpers consumable by admin dashboards / future VQI bridge. */
export function cqiSignalsByDisorder(): Array<{
  disorder: string;
  n: number;
}> {
  const m = new Map<string, number>();
  for (const s of MEMORY) {
    const d = s.disorder_slug ?? "unknown";
    m.set(d, (m.get(d) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([disorder, n]) => ({ disorder, n }))
    .sort((a, b) => b.n - a.n);
}

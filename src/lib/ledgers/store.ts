/**
 * In-memory append-only stores for multi-ledger (offline / pre-migration).
 */

import type { EducationalEvent } from "@/lib/ledgers/education";
import type { OperationalEvent } from "@/lib/ledgers/operational";
import type { LedgerCorrelation } from "@/lib/ledgers/shared";

const operational: OperationalEvent[] = [];
const educational: EducationalEvent[] = [];
const correlations: LedgerCorrelation[] = [];

export function appendOperationalMemory(e: OperationalEvent): OperationalEvent {
  if (operational.some((x) => x.event_id === e.event_id || x.id === e.id)) {
    throw new Error(`Operational event ${e.event_id} already exists`);
  }
  const sealed = Object.freeze({ ...e }) as OperationalEvent;
  operational.push(sealed);
  return sealed;
}

export function appendEducationalMemory(e: EducationalEvent): EducationalEvent {
  if (educational.some((x) => x.event_id === e.event_id || x.id === e.id)) {
    throw new Error(`Educational event ${e.event_id} already exists`);
  }
  const sealed = Object.freeze({ ...e }) as EducationalEvent;
  educational.push(sealed);
  return sealed;
}

export function appendCorrelationMemory(
  c: LedgerCorrelation,
): LedgerCorrelation {
  const sealed = Object.freeze({ ...c }) as LedgerCorrelation;
  correlations.push(sealed);
  return sealed;
}

export function listOperationalMemory(limit = 500): OperationalEvent[] {
  return operational.slice(-limit).reverse();
}

export function listEducationalMemory(limit = 500): EducationalEvent[] {
  return educational.slice(-limit).reverse();
}

export function listCorrelationsMemory(limit = 500): LedgerCorrelation[] {
  return correlations.slice(-limit).reverse();
}

export function clearMultiLedgerMemoryForTests(): void {
  operational.length = 0;
  educational.length = 0;
  correlations.length = 0;
}

export function multiLedgerMemoryCounts() {
  return {
    operational: operational.length,
    educational: educational.length,
    correlations: correlations.length,
  };
}

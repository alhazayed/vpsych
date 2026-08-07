/**
 * Phase 16 — Evidence state primitives.
 *
 * Never fabricate operational, clinical, educational, research, DR, PITR,
 * penetration-test, or feedback evidence. Missing observations → Evidence Pending.
 */

export const EVIDENCE_PENDING = "Evidence Pending" as const;

export type EvidenceState = "OBSERVED" | "EVIDENCE_PENDING";

export type EvidenceValue<T = number> = {
  state: EvidenceState;
  value: T | null;
  label: string;
  unit?: string;
  source?: string;
  note?: string;
};

export function observed<T>(
  label: string,
  value: T,
  opts?: { unit?: string; source?: string; note?: string },
): EvidenceValue<T> {
  return {
    state: "OBSERVED",
    value,
    label,
    unit: opts?.unit,
    source: opts?.source,
    note: opts?.note,
  };
}

export function pending<T = number>(
  label: string,
  opts?: { unit?: string; source?: string; note?: string },
): EvidenceValue<T> {
  return {
    state: "EVIDENCE_PENDING",
    value: null,
    label,
    unit: opts?.unit,
    source: opts?.source,
    note: opts?.note ?? EVIDENCE_PENDING,
  };
}

/** Prefer OBSERVED only when a finite number was actually supplied. */
export function observedNumberOrPending(
  label: string,
  value: number | undefined | null,
  opts?: { unit?: string; source?: string; note?: string },
): EvidenceValue<number> {
  if (typeof value === "number" && Number.isFinite(value)) {
    return observed(label, value, opts);
  }
  return pending(label, opts);
}

export function displayEvidence(ev: EvidenceValue): string {
  if (ev.state === "EVIDENCE_PENDING" || ev.value === null) {
    return EVIDENCE_PENDING;
  }
  return `${ev.value}${ev.unit ?? ""}`;
}

export function allObserved(items: EvidenceValue[]): boolean {
  return items.length > 0 && items.every((i) => i.state === "OBSERVED");
}

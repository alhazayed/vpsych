"use client";

import type { VirtualPatientLifecycle } from "@/lib/admin/virtual-patients";

const LABELS: Record<VirtualPatientLifecycle, string> = {
  draft: "Draft",
  testing: "Testing",
  published: "Published",
  archived: "Archived",
};

const CHIP_CLASS: Record<VirtualPatientLifecycle, string> = {
  draft: "bg-[var(--surface-container-high)] text-[var(--on-surface-variant)]",
  testing:
    "bg-[color-mix(in_srgb,var(--secondary)_12%,transparent)] text-[var(--secondary)]",
  published:
    "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]",
  archived: "bg-[var(--surface-container)] text-[var(--outline)]",
};

export function StatusBadge({ status }: { status: VirtualPatientLifecycle }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide ${CHIP_CLASS[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

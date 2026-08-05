import { randomUUID } from "crypto";
import type { EoiClusterDraft, EoiOpportunityRow } from "@/lib/eoi/types";

const ROWS: EoiOpportunityRow[] = [];
const CLUSTERS: Array<EoiClusterDraft & { id: string }> = [];

export function eoiMemoryEnabled(): boolean {
  return process.env.EOI_MEMORY_FALLBACK !== "0";
}

export function eoiMemoryInsert(
  row: Omit<EoiOpportunityRow, "id" | "created_at" | "status" | "cluster_id" | "analyst"> &
    Partial<Pick<EoiOpportunityRow, "status">>,
): EoiOpportunityRow {
  const full: EoiOpportunityRow = {
    ...row,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    status: row.status ?? "open",
    cluster_id: null,
    analyst: {},
    annotations: row.annotations ?? [],
    transcript_window: row.transcript_window ?? [],
    evidence: row.evidence ?? {},
    context: row.context ?? {},
  };
  ROWS.push(full);
  if (ROWS.length > 10000) ROWS.splice(0, ROWS.length - 10000);
  return full;
}

export function eoiMemoryList(): EoiOpportunityRow[] {
  return [...ROWS];
}

export function eoiMemoryReplaceClusters(
  drafts: EoiClusterDraft[],
): Array<EoiClusterDraft & { id: string }> {
  CLUSTERS.length = 0;
  for (const d of drafts) CLUSTERS.push({ ...d, id: randomUUID() });
  return [...CLUSTERS];
}

export function eoiMemoryListClusters(): Array<EoiClusterDraft & { id: string }> {
  return [...CLUSTERS];
}

export function eoiMemoryClear(): void {
  ROWS.length = 0;
  CLUSTERS.length = 0;
}

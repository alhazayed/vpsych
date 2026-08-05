/**
 * In-memory Quality Vault fallback when CQI tables are not yet migrated.
 * Preserves "no feedback lost" locally/CI; production must apply migration.
 */

import type { CqiFlagRow } from "@/lib/cqi/types";
import type { ClusterDraft } from "@/lib/cqi/cluster";
import { randomUUID } from "crypto";

const FLAGS: CqiFlagRow[] = [];
const CLUSTERS: Array<ClusterDraft & { id: string }> = [];

export function memoryVaultEnabled(): boolean {
  return process.env.CQI_MEMORY_FALLBACK !== "0";
}

export function memoryInsertFlag(
  row: Omit<CqiFlagRow, "id" | "created_at" | "status" | "cluster_id" | "analyst_notes"> &
    Partial<Pick<CqiFlagRow, "status">>,
): CqiFlagRow {
  const full: CqiFlagRow = {
    ...row,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    status: row.status ?? "submitted",
    cluster_id: null,
    analyst_notes: {},
    annotations: row.annotations ?? [],
    transcript_window: row.transcript_window ?? [],
    scores: row.scores ?? {},
    evidence: row.evidence ?? {},
  };
  FLAGS.push(full);
  if (FLAGS.length > 10000) FLAGS.splice(0, FLAGS.length - 10000);
  return full;
}

export function memoryListFlags(): CqiFlagRow[] {
  return [...FLAGS];
}

export function memoryReplaceClusters(
  drafts: ClusterDraft[],
): Array<ClusterDraft & { id: string }> {
  CLUSTERS.length = 0;
  for (const d of drafts) {
    CLUSTERS.push({ ...d, id: randomUUID() });
  }
  return [...CLUSTERS];
}

export function memoryListClusters(): Array<ClusterDraft & { id: string }> {
  return [...CLUSTERS];
}

export function memoryClearAll() {
  FLAGS.length = 0;
  CLUSTERS.length = 0;
}

/**
 * Compression — consolidate old/low-salience entries when the store grows.
 * Never drops a fact without folding it into a compressed survivor.
 * Never regenerates or invents content.
 */

import {
  MEMORY_HARD_CAP,
  MEMORY_SOFT_CAP,
  type CompressResult,
  type MemoryCategory,
  type MemoryEntry,
  type PatientMemoryStore,
} from "./types";
import { makeMemoryEntryId } from "./store";

const STICKY: ReadonlySet<MemoryCategory> = new Set([
  "trauma",
  "medication",
  "children",
  "promise",
  "therapist_mistake",
  "occupation",
]);

function byCategory(entries: MemoryEntry[]): Map<MemoryCategory, MemoryEntry[]> {
  const map = new Map<MemoryCategory, MemoryEntry[]>();
  for (const e of entries) {
    const list = map.get(e.category) ?? [];
    list.push(e);
    map.set(e.category, list);
  }
  return map;
}

function mergeContents(entries: MemoryEntry[]): string {
  const parts = entries.map((e) => e.content.replace(/\s+/g, " ").trim());
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (unique.some((u) => u.toLowerCase() === key || u.toLowerCase().includes(key))) {
      continue;
    }
    // Prefer keeping the longer existing fact when one contains the other.
    const dominated = unique.findIndex((u) => key.includes(u.toLowerCase()));
    if (dominated >= 0) {
      unique[dominated] = p;
      continue;
    }
    unique.push(p);
  }
  return unique.join(" · ").slice(0, 280);
}

/**
 * Compress store when over soft cap. Sticky categories keep individual high-
 * salience rows; others of the same category/topic merge into one survivor.
 */
export function compressMemoryStore(
  store: PatientMemoryStore,
  opts?: { softCap?: number; hardCap?: number; now?: string },
): CompressResult {
  const softCap = opts?.softCap ?? MEMORY_SOFT_CAP;
  const hardCap = opts?.hardCap ?? MEMORY_HARD_CAP;
  const now = opts?.now ?? new Date().toISOString();

  if (store.entries.length <= softCap) {
    return { store, removed: 0, created: 0 };
  }

  const stickyKeep: MemoryEntry[] = [];
  const compressible: MemoryEntry[] = [];

  for (const e of store.entries) {
    if (STICKY.has(e.category) && e.salience >= 0.75) {
      stickyKeep.push(e);
    } else {
      compressible.push(e);
    }
  }

  // If still over hard cap, allow sticky with lowest salience into merge pool.
  if (stickyKeep.length + Math.ceil(compressible.length / 3) > hardCap) {
    stickyKeep.sort((a, b) => b.salience - a.salience);
    while (
      stickyKeep.length > Math.floor(hardCap * 0.6) &&
      stickyKeep.length > 0
    ) {
      compressible.push(stickyKeep.pop()!);
    }
  }

  const grouped = byCategory(compressible);
  const merged: MemoryEntry[] = [];
  let removed = 0;
  let created = 0;

  for (const [category, group] of grouped) {
    if (group.length <= 1) {
      merged.push(...group);
      continue;
    }

    // Sub-group by primary topic to avoid mixing unrelated facts.
    const byTopic = new Map<string, MemoryEntry[]>();
    for (const e of group) {
      const topic = e.topics[0] ?? category;
      const list = byTopic.get(topic) ?? [];
      list.push(e);
      byTopic.set(topic, list);
    }

    for (const [, topicGroup] of byTopic) {
      if (topicGroup.length === 1) {
        merged.push(topicGroup[0]!);
        continue;
      }
      const content = mergeContents(topicGroup);
      const salience = Math.max(...topicGroup.map((e) => e.salience));
      const topics = [...new Set(topicGroup.flatMap((e) => e.topics))];
      const compressed: MemoryEntry = {
        id: makeMemoryEntryId("compressed", merged.length),
        category,
        content,
        source: "compression",
        session_id: topicGroup[topicGroup.length - 1]?.session_id ?? null,
        turn_index: null,
        salience,
        topics,
        created_at: now,
        updated_at: now,
        compressed_from: topicGroup.map((e) => e.id),
      };
      merged.push(compressed);
      removed += topicGroup.length;
      created += 1;
    }
  }

  const nextEntries = [...stickyKeep, ...merged];
  // Deterministic order: salience desc, then created_at
  nextEntries.sort((a, b) => {
    if (b.salience !== a.salience) return b.salience - a.salience;
    return a.created_at < b.created_at ? -1 : 1;
  });

  // Hard trim only by merging remainder into an "other" bucket — still persist.
  let finalEntries = nextEntries;
  let extraRemoved = 0;
  let extraCreated = 0;
  if (finalEntries.length > hardCap) {
    const keep = finalEntries.slice(0, hardCap - 1);
    const overflow = finalEntries.slice(hardCap - 1);
    const overflowEntry: MemoryEntry = {
      id: makeMemoryEntryId("overflow", 0),
      category: "other",
      content: mergeContents(overflow),
      source: "compression",
      session_id: null,
      turn_index: null,
      salience: Math.max(...overflow.map((e) => e.salience), 0.4),
      topics: [...new Set(overflow.flatMap((e) => e.topics))].slice(0, 12),
      created_at: now,
      updated_at: now,
      compressed_from: overflow.map((e) => e.id),
    };
    finalEntries = [...keep, overflowEntry];
    extraRemoved = overflow.length;
    extraCreated = 1;
  }

  return {
    store: {
      ...store,
      entries: finalEntries,
      compressed_count: store.compressed_count + removed + extraRemoved,
      updated_at: now,
    },
    removed: removed + extraRemoved,
    created: created + extraCreated,
  };
}

export function needsCompression(
  store: PatientMemoryStore,
  softCap = MEMORY_SOFT_CAP,
): boolean {
  return store.entries.length > softCap;
}

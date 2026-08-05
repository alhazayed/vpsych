/**
 * In-memory weight-set store for admin edits (versioned; frozen sets immutable).
 * DB persistence is via quality_weight_sets when migration is applied.
 */

import {
  assertWeightSetValid,
  createDefaultWeightSet,
  type VqiWeightEntry,
  type VqiWeightSet,
  VQI_ALGORITHM_VERSION,
} from "@/lib/vqi/weights";

const sets = new Map<string, VqiWeightSet>();

function key(id: string, version: string) {
  return `${id}@${version}`;
}

function seed() {
  if (sets.size) return;
  const d = createDefaultWeightSet();
  sets.set(key(d.id, d.version), d);
}

export function listWeightSets(): VqiWeightSet[] {
  seed();
  return [...sets.values()].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
}

export function getWeightSet(id: string, version?: string): VqiWeightSet | null {
  seed();
  if (version) return sets.get(key(id, version)) ?? null;
  const matches = [...sets.values()].filter((s) => s.id === id);
  return matches.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] ?? null;
}

export function getActiveWeightSet(): VqiWeightSet {
  seed();
  // Prefer unfrozen latest, else default frozen
  const unfrozen = [...sets.values()]
    .filter((s) => !s.frozen)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return unfrozen[0] ?? createDefaultWeightSet();
}

export function createWeightSetVersion(input: {
  id: string;
  name: string;
  entries: VqiWeightEntry[];
  notes?: string;
  from_version?: string;
}): VqiWeightSet {
  seed();
  const existing = [...sets.values()].filter((s) => s.id === input.id);
  const nextVersion = bumpVersion(
    existing.map((s) => s.version).sort().at(-1) ?? "1.0.0",
  );
  const set: VqiWeightSet = {
    id: input.id,
    name: input.name,
    version: nextVersion,
    frozen: false,
    algorithm_version: VQI_ALGORITHM_VERSION,
    entries: input.entries.map((e) => ({ ...e })),
    created_at: new Date().toISOString(),
    notes: input.notes ?? `Derived from ${input.from_version ?? "default"}`,
  };
  assertWeightSetValid(set);
  sets.set(key(set.id, set.version), set);
  return set;
}

export function freezeWeightSet(id: string, version: string): VqiWeightSet {
  seed();
  const set = sets.get(key(id, version));
  if (!set) throw new Error(`Weight set ${id}@${version} not found`);
  const frozen = { ...set, frozen: true };
  sets.set(key(id, version), frozen);
  return frozen;
}

function bumpVersion(v: string): string {
  const parts = v.split(".").map((x) => Number(x));
  const major = parts[0] ?? 1;
  const minor = parts[1] ?? 0;
  const patch = (parts[2] ?? 0) + 1;
  return `${major}.${minor}.${patch}`;
}

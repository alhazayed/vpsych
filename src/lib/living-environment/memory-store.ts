/**
 * Process-local LivingWorld cache — mirrors Quality Ledger / patient-memory
 * fallbacks when the DB table is missing.
 */

import type { LivingWorld } from "./types";

const store = new Map<string, LivingWorld>();

function keyFor(caseInstanceId: string): string {
  return caseInstanceId;
}

export function getLivingWorldMemory(
  caseInstanceId: string,
): LivingWorld | null {
  return store.get(keyFor(caseInstanceId)) ?? null;
}

export function putLivingWorldMemory(world: LivingWorld): LivingWorld {
  const id = world.case_instance_id ?? world.world_id;
  store.set(keyFor(id), world);
  if (world.case_instance_id && world.case_instance_id !== world.world_id) {
    store.set(keyFor(world.case_instance_id), world);
  }
  return world;
}

export function clearLivingWorldMemoryForTests(): void {
  store.clear();
}

export function livingWorldMemoryCount(): number {
  return store.size;
}

/**
 * In-memory supervisor run store (ephemeral, like Stage 8 validation store).
 * Never persists patient clinical state.
 */

import type { SupervisorSessionBundle } from "@/lib/supervisor/types";

const runs = new Map<string, SupervisorSessionBundle>();
const byUser = new Map<string, string[]>();

export function storeSupervisorBundle(
  userId: string,
  bundle: SupervisorSessionBundle,
): void {
  runs.set(bundle.session_id, bundle);
  const list = byUser.get(userId) ?? [];
  list.push(bundle.session_id);
  byUser.set(userId, list.slice(-100));
}

export function getSupervisorBundle(
  sessionId: string,
): SupervisorSessionBundle | null {
  return runs.get(sessionId) ?? null;
}

export function listSupervisorBundlesForUser(
  userId: string,
): SupervisorSessionBundle[] {
  const ids = byUser.get(userId) ?? [];
  return ids
    .map((id) => runs.get(id))
    .filter((b): b is SupervisorSessionBundle => Boolean(b));
}

export function clearSupervisorStoreForTests(): void {
  runs.clear();
  byUser.clear();
}

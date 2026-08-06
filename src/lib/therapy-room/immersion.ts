/**
 * Immersion event bus — future VR / AR / eye-tracking / haptics / body anim.
 *
 * Room UI publishes; adapters subscribe. No redesign required to add a device.
 * Distinct from TRM's ImmersionEvent / TRII tracker in immersion-index.ts.
 */

import type {
  ClinicImmersionAdapter,
  ClinicImmersionChannel,
  ClinicImmersionEvent,
} from "./types";

const adapters = new Map<string, ClinicImmersionAdapter>();

export function registerImmersionAdapter(
  adapter: ClinicImmersionAdapter,
): () => void {
  adapters.set(adapter.id, adapter);
  return () => {
    adapter.dispose?.();
    adapters.delete(adapter.id);
  };
}

export function listImmersionAdapters(): ClinicImmersionAdapter[] {
  return [...adapters.values()];
}

export function publishImmersionEvent(
  channel: ClinicImmersionChannel,
  payload: Record<string, unknown> = {},
): ClinicImmersionEvent {
  const event: ClinicImmersionEvent = {
    channel,
    at: Date.now(),
    payload,
  };
  for (const adapter of adapters.values()) {
    if (!adapter.channels.includes(channel)) continue;
    void Promise.resolve(adapter.onEvent(event)).catch(() => {
      /* best-effort — immersion must never break the session */
    });
  }
  return event;
}

/** Convenience: notify phase transitions for all room UIs / future runtimes. */
export function publishRoomPhase(
  phase: string,
  extra: Record<string, unknown> = {},
): ClinicImmersionEvent {
  return publishImmersionEvent("session.phase", { phase, ...extra });
}

export function clearImmersionAdapters(): void {
  for (const a of adapters.values()) a.dispose?.();
  adapters.clear();
}

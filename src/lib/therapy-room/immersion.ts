/**
 * Immersion event bus — future VR / AR / eye-tracking / haptics / body anim.
 *
 * Room UI publishes; adapters subscribe. No redesign required to add a device.
 */

import type { ImmersionAdapter, ImmersionChannel, ImmersionEvent } from "./types";

const adapters = new Map<string, ImmersionAdapter>();

export function registerImmersionAdapter(adapter: ImmersionAdapter): () => void {
  adapters.set(adapter.id, adapter);
  return () => {
    adapter.dispose?.();
    adapters.delete(adapter.id);
  };
}

export function listImmersionAdapters(): ImmersionAdapter[] {
  return [...adapters.values()];
}

export function publishImmersionEvent(
  channel: ImmersionChannel,
  payload: Record<string, unknown> = {},
): ImmersionEvent {
  const event: ImmersionEvent = {
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
): ImmersionEvent {
  return publishImmersionEvent("session.phase", { phase, ...extra });
}

export function clearImmersionAdapters(): void {
  for (const a of adapters.values()) a.dispose?.();
  adapters.clear();
}

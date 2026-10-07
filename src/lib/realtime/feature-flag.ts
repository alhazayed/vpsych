/**
 * Stage 11 realtime simulation feature flags.
 *
 * Realtime streaming / enhanced avatar sync opt-in via flags.
 */

export function isRealtimeSimulationEnabled(): boolean {
  const server = process.env.FEATURE_REALTIME_SIMULATION?.trim().toLowerCase();
  const pub =
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_SIMULATION?.trim().toLowerCase();
  return server === "true" || pub === "true";
}

/**
 * Streaming LLM token path (SSE `/message/stream` + progressive TTS).
 *
 * Requires the realtime simulation flag AND an explicit
 * FEATURE_REALTIME_STREAMING=true (or NEXT_PUBLIC_…=true). It is never on by
 * default: enabling the simulation surface alone must not silently move
 * production voice turns onto the streaming path. Classic /message stays the
 * default and the fallback.
 */
export function isRealtimeStreamingEnabled(): boolean {
  if (!isRealtimeSimulationEnabled()) return false;
  const v = process.env.FEATURE_REALTIME_STREAMING?.trim().toLowerCase();
  const pub =
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_STREAMING?.trim().toLowerCase();
  if (v === "false" || pub === "false") return false;
  return v === "true" || pub === "true";
}

/**
 * Therapy Room reply streaming: the room asks /message/stream for the
 * patient's reply and starts speaking the first released sentence while the
 * rest is generated. On by default (owner's decision, 2026-10-07); set
 * THERAPY_ROOM_STREAMING=false (server) or NEXT_PUBLIC_THERAPY_ROOM_STREAMING=false
 * (client) to return to the classic /message turn. Independent of the
 * realtime simulation flags above, which stay off by default.
 */
export function isTherapyRoomStreamingEnabled(): boolean {
  const v = process.env.THERAPY_ROOM_STREAMING?.trim().toLowerCase();
  const pub = process.env.NEXT_PUBLIC_THERAPY_ROOM_STREAMING?.trim().toLowerCase();
  return v !== "false" && pub !== "false";
}

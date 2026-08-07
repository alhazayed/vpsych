/**
 * Stage 11 realtime simulation feature flags.
 *
 * Classic VoiceSession remains the default interaction path.
 * Realtime streaming / enhanced avatar sync opt-in via flags.
 */

export function isRealtimeSimulationEnabled(): boolean {
  const server = process.env.FEATURE_REALTIME_SIMULATION?.trim().toLowerCase();
  const pub =
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_SIMULATION?.trim().toLowerCase();
  return server === "true" || pub === "true";
}

/** Streaming LLM token path (SSE). Requires realtime flag. */
export function isRealtimeStreamingEnabled(): boolean {
  if (!isRealtimeSimulationEnabled()) return false;
  const v = process.env.FEATURE_REALTIME_STREAMING?.trim().toLowerCase();
  const pub =
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_STREAMING?.trim().toLowerCase();
  if (v === "false" || pub === "false") return false;
  // Default on when realtime simulation is enabled.
  return true;
}

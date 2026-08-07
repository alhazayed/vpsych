/**
 * Stage 11 — SSE helpers for streamed patient turns.
 *
 * Cognition remains on the classic message path / patient-agent.
 * This module only encodes presentation stream events.
 */

import {
  createTokenStreamController,
  encodeSse,
  progressiveTokens,
} from "@/lib/realtime/llm-streaming";
import type { StreamEvent } from "@/lib/realtime/types";

export function buildStatusEvent(
  sequence: number,
  status: string,
  extra?: Record<string, unknown>,
): StreamEvent {
  return {
    type: "status",
    ts: Date.now(),
    sequence,
    payload: { status, ...extra },
  };
}

/**
 * Progressive token reveal for a completed reply (network-recovery /
 * non-stream provider fallback). Still presentation-only.
 */
export function progressiveRevealEvents(
  text: string,
  startSequence = 0,
): StreamEvent[] {
  const controller = createTokenStreamController();
  // Re-sequence from caller start via manual events.
  const events: StreamEvent[] = [];
  let seq = startSequence;
  let acc = "";
  for (const token of progressiveTokens(text, 4)) {
    acc += token;
    events.push({
      type: "token",
      ts: Date.now(),
      sequence: ++seq,
      payload: { token, text: acc },
    });
  }
  events.push({
    type: "done",
    ts: Date.now(),
    sequence: ++seq,
    payload: { text },
  });
  void controller;
  return events;
}

export function sseEncoder() {
  const encoder = new TextEncoder();
  return {
    encode(event: StreamEvent) {
      return encoder.encode(encodeSse(event));
    },
  };
}

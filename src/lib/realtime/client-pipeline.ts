/**
 * Client helpers for Stage 11 streaming turns + interrupt signaling.
 */

import { isRealtimeStreamingEnabled } from "@/lib/realtime/feature-flag";
import type { StreamEvent } from "@/lib/realtime/types";

export type StreamTurnHandlers = {
  onEvent?: (event: StreamEvent) => void;
  onToken?: (token: string, text: string) => void;
  onDone?: (payload: Record<string, unknown>) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
};

/**
 * Prefer SSE stream route when enabled; callers may fall back to classic message.
 */
export async function submitStreamingConversationTurn(params: {
  sessionId: string;
  message: string;
  therapistInterrupted?: boolean;
  handlers?: StreamTurnHandlers;
}): Promise<{ ok: boolean; usedStream: boolean; error?: string }> {
  if (!isRealtimeStreamingEnabled()) {
    return { ok: false, usedStream: false, error: "streaming_disabled" };
  }

  const res = await fetch(
    `/api/sessions/${params.sessionId}/message/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: params.message,
        ...(params.therapistInterrupted
          ? { therapistInterrupted: true }
          : {}),
      }),
      signal: params.handlers?.signal,
    },
  );

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    params.handlers?.onError?.(data.error ?? "stream_failed");
    return {
      ok: false,
      usedStream: true,
      error: data.error ?? "stream_failed",
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = parseSseBlock(part);
      if (!event) continue;
      params.handlers?.onEvent?.(event);
      if (event.type === "token") {
        const token = String(event.payload?.token ?? "");
        const text = String(event.payload?.text ?? "");
        params.handlers?.onToken?.(token, text);
      }
      if (event.type === "done") {
        params.handlers?.onDone?.(event.payload ?? {});
      }
      if (event.type === "error") {
        params.handlers?.onError?.(String(event.payload?.message ?? "error"));
      }
    }
  }

  return { ok: true, usedStream: true };
}

function parseSseBlock(block: string): StreamEvent | null {
  const lines = block.split("\n");
  let type = "message";
  let data = "";
  for (const line of lines) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as StreamEvent;
    return { ...parsed, type: (parsed.type ?? type) as StreamEvent["type"] };
  } catch {
    return null;
  }
}

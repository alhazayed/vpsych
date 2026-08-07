/**
 * LLM Streaming Engine — token stream control plane.
 *
 * Owns backpressure, interruption, resume markers, timeout/retry recovery.
 * Does NOT own patient cognition — call sites pass already-resolved prompts
 * into patient-agent streaming helpers.
 */

import type { StreamEvent } from "@/lib/realtime/types";

export type TokenStreamController = {
  pushToken: (token: string) => void;
  pushPartial: (text: string) => void;
  interrupt: (reason?: string) => void;
  resume: () => void;
  complete: (finalText: string) => void;
  fail: (message: string) => void;
  events: () => StreamEvent[];
  text: () => string;
  interrupted: () => boolean;
  done: () => boolean;
};

export type TokenStreamOptions = {
  /** Max buffered unread events before backpressure flag. */
  highWaterMark?: number;
  onBackpressure?: (active: boolean) => void;
};

export function createTokenStreamController(
  opts: TokenStreamOptions = {},
): TokenStreamController {
  const highWaterMark = opts.highWaterMark ?? 64;
  const events: StreamEvent[] = [];
  let sequence = 0;
  let text = "";
  let interrupted = false;
  let done = false;

  const emit = (
    type: StreamEvent["type"],
    payload?: Record<string, unknown>,
  ) => {
    const event: StreamEvent = {
      type,
      ts: Date.now(),
      sequence: ++sequence,
      payload,
    };
    events.push(event);
    opts.onBackpressure?.(events.length >= highWaterMark);
    return event;
  };

  return {
    pushToken(token) {
      if (done || interrupted) return;
      text += token;
      emit("token", { token, text });
    },
    pushPartial(partial) {
      if (done || interrupted) return;
      text = partial;
      emit("partial", { text });
    },
    interrupt(reason = "client_interrupt") {
      if (done) return;
      interrupted = true;
      emit("interrupted", { reason, text });
    },
    resume() {
      if (done) return;
      interrupted = false;
      emit("resume", { text });
    },
    complete(finalText) {
      if (done) return;
      text = finalText || text;
      done = true;
      emit("done", { text });
    },
    fail(message) {
      done = true;
      emit("error", { message, text });
    },
    events: () => [...events],
    text: () => text,
    interrupted: () => interrupted,
    done: () => done,
  };
}

export type StreamRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
};

export async function withStreamRetry<T>(
  fn: (attempt: number, signal: AbortSignal) => Promise<T>,
  opts: StreamRetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fn(attempt, controller.signal);
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt >= maxAttempts) break;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Stream retry exhausted");
}

export function encodeSse(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function createSseResponse(
  stream: ReadableStream<Uint8Array>,
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Progressive reveal helper when full text is already available. */
export function* progressiveTokens(
  text: string,
  chunkSize = 3,
): Generator<string> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
  }
}

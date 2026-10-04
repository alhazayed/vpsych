/**
 * Client side of the realtime streamed patient turn (SSE).
 *
 * POST /api/sessions/:id/message/stream → started → token* / sentence* /
 * regenerating* → done | interrupted | error.
 *
 * Contract with callers:
 *   - Token and sentence callbacks are PROVISIONAL presentation. Only a
 *     `completed` result carries the persisted assistant message.
 *   - `interrupted` (abort / barge-in) is never reported as completed, and its
 *     partial text is never a reply.
 *   - `fallbackToClassic` is true only when the server answered with an HTTP
 *     error before the SSE stream opened — the route returns those before the
 *     therapist message is persisted, so re-sending to /message cannot
 *     duplicate the turn or tick the patient engines twice. Once the stream
 *     opened (HTTP 200) the therapist message exists server-side and the
 *     classic route must not be re-posted for the same utterance.
 *   - Every callback is fenced: events from an older draft attempt, a
 *     different turn id, a replayed sequence, or a turn that is no longer
 *     current (`isCurrent()`) are dropped.
 */

import { createSseParser } from "@/lib/realtime/sse-parser";
import type { StreamEvent } from "@/lib/realtime/types";
import {
  resolvePipelineLocale,
  type PipelineTurnResult,
} from "@/lib/voice/conversation-pipeline";
import type { SessionMessage } from "@/lib/voice/pipeline-types";

export type StreamSentence = {
  text: string;
  index: number;
  attempt: number;
  /** True when released after full validation (held sentence). */
  validated: boolean;
};

export type StreamStartedInfo = {
  userMessage: SessionMessage;
  voiceHints: PipelineTurnResult["voiceHints"];
  locale: PipelineTurnResult["locale"];
};

export type StreamTurnHandlers = {
  onEvent?: (event: StreamEvent) => void;
  onStarted?: (info: StreamStartedInfo) => void;
  onToken?: (token: string, text: string, attempt: number) => void;
  onSentence?: (sentence: StreamSentence) => void;
  /** Draft discarded: drop its text and any audio of earlier attempts. */
  onRegenerating?: (info: { attempt: number; reason: string }) => void;
  signal?: AbortSignal;
};

export type StreamingTurnResult =
  | {
      status: "completed";
      data: PipelineTurnResult;
      aiSource: string | null;
      payload: Record<string, unknown>;
    }
  | {
      status: "interrupted";
      userMessage: SessionMessage | null;
      /** Provisional text at the moment of interruption — never persisted. */
      partialText: string;
    }
  | {
      status: "failed";
      error: string;
      httpStatus?: number;
      expired?: boolean;
      fallbackToClassic: boolean;
      userMessage: SessionMessage | null;
    }
  /** The turn was superseded (fence advanced); nothing was applied. */
  | { status: "stale" };

/** HTTP statuses where the stream route guarantees nothing was persisted
 * and the classic route may answer differently (disabled / server error). */
function classicFallbackAllowed(status: number): boolean {
  return status === 404 || status === 405 || status >= 500;
}

function asMessage(value: unknown): SessionMessage | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Partial<SessionMessage>;
  return typeof m.id === "string" || typeof m.id === "number"
    ? (value as SessionMessage)
    : null;
}

/**
 * Run one streamed patient turn. Never throws for transport errors.
 * Callers should fall back to `submitConversationTurn` (classic /message)
 * only when the result is `failed` with `fallbackToClassic: true`.
 */
export async function submitStreamingConversationTurn(params: {
  sessionId: string;
  message: string;
  therapistInterrupted?: boolean;
  /** Echoed by the server on every event; events for other ids are dropped. */
  clientTurnId?: string;
  /** Turn fence check — evaluated before every callback. */
  isCurrent?: () => boolean;
  handlers?: StreamTurnHandlers;
  fetchImpl?: typeof fetch;
}): Promise<StreamingTurnResult> {
  const handlers = params.handlers ?? {};
  const signal = handlers.signal;
  const isCurrent = () =>
    !(signal?.aborted ?? false) && (params.isCurrent?.() ?? true);
  const doFetch = params.fetchImpl ?? fetch;

  if (!isCurrent()) return { status: "stale" };

  let res: Response;
  try {
    res = await doFetch(`/api/sessions/${params.sessionId}/message/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        message: params.message,
        ...(params.therapistInterrupted ? { therapistInterrupted: true } : {}),
        ...(params.clientTurnId ? { clientTurnId: params.clientTurnId } : {}),
      }),
      signal,
    });
  } catch {
    if (signal?.aborted) {
      return { status: "interrupted", userMessage: null, partialText: "" };
    }
    // Ambiguous: the request may have reached the server. Do not re-post.
    return {
      status: "failed",
      error: "network_error",
      fallbackToClassic: false,
      userMessage: null,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !res.body || !contentType.includes("text/event-stream")) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      expired?: boolean;
    };
    return {
      status: "failed",
      error: data.error ?? "stream_failed",
      httpStatus: res.status,
      expired: Boolean(data.expired),
      // A 200 that is not an event stream never persisted anything either.
      fallbackToClassic: res.ok || classicFallbackAllowed(res.status),
      userMessage: null,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  let lastSequence = 0;
  let attempt = 1;
  let partialText = "";
  let userMessage: SessionMessage | null = null;

  const stop = () => {
    void reader.cancel().catch(() => {});
  };

  const interrupted = (): StreamingTurnResult => ({
    status: "interrupted",
    userMessage,
    partialText,
  });

  /** Returns a terminal result, or null to keep reading. */
  const apply = (event: StreamEvent): StreamingTurnResult | null => {
    const payload = event.payload ?? {};
    if (
      params.clientTurnId &&
      payload.turnId !== undefined &&
      payload.turnId !== params.clientTurnId
    ) {
      return null;
    }
    if (typeof event.sequence === "number") {
      if (event.sequence <= lastSequence) return null;
      lastSequence = event.sequence;
    }
    handlers.onEvent?.(event);
    const eventAttempt =
      typeof payload.attempt === "number" ? payload.attempt : attempt;

    switch (event.type) {
      case "started": {
        userMessage = asMessage(payload.userMessage);
        if (userMessage) {
          handlers.onStarted?.({
            userMessage,
            voiceHints:
              (payload.voiceHints as PipelineTurnResult["voiceHints"]) ?? null,
            locale: resolvePipelineLocale(
              typeof payload.locale === "string" ? payload.locale : null,
            ),
          });
        }
        return null;
      }
      case "token": {
        if (eventAttempt < attempt) return null;
        attempt = eventAttempt;
        partialText = String(payload.text ?? "");
        handlers.onToken?.(String(payload.token ?? ""), partialText, attempt);
        return null;
      }
      case "sentence": {
        if (eventAttempt < attempt) return null;
        attempt = eventAttempt;
        const text = String(payload.text ?? "").trim();
        if (text) {
          handlers.onSentence?.({
            text,
            index: Number(payload.index ?? 0),
            attempt,
            validated: payload.validated === true,
          });
        }
        return null;
      }
      case "regenerating": {
        // Attempts only move forward; a replayed / older reset is stale.
        if (eventAttempt <= attempt) return null;
        attempt = eventAttempt;
        partialText = "";
        handlers.onRegenerating?.({
          attempt,
          reason: String(payload.reason ?? "regenerating"),
        });
        return null;
      }
      case "done": {
        const user = asMessage(payload.userMessage) ?? userMessage;
        const assistant = asMessage(payload.assistantMessage);
        if (!user || !assistant) {
          return {
            status: "failed",
            error: "Incomplete message response",
            fallbackToClassic: false,
            userMessage: user,
          };
        }
        return {
          status: "completed",
          aiSource:
            typeof payload.aiSource === "string" ? payload.aiSource : null,
          payload,
          data: {
            userMessage: user,
            assistantMessage: assistant,
            remainingSeconds:
              typeof payload.remainingSeconds === "number"
                ? payload.remainingSeconds
                : undefined,
            locale: resolvePipelineLocale(
              typeof payload.locale === "string" ? payload.locale : null,
            ),
            voiceHints:
              (payload.voiceHints as PipelineTurnResult["voiceHints"]) ?? null,
            humanizationEnabled: Boolean(payload.humanizationEnabled),
          },
        };
      }
      case "interrupted":
        return interrupted();
      case "error":
        return {
          status: "failed",
          error: String(payload.message ?? "Streaming turn failed"),
          httpStatus:
            typeof payload.status === "number" ? payload.status : undefined,
          fallbackToClassic: false,
          userMessage,
        };
      default:
        return null;
    }
  };

  try {
    for (;;) {
      if (!isCurrent()) {
        stop();
        return signal?.aborted ? interrupted() : { status: "stale" };
      }
      const { done, value } = await reader.read();
      if (!isCurrent()) {
        stop();
        return signal?.aborted ? interrupted() : { status: "stale" };
      }
      if (done) break;
      for (const msg of parser.push(decoder.decode(value, { stream: true }))) {
        let event: StreamEvent;
        try {
          event = JSON.parse(msg.data) as StreamEvent;
        } catch {
          continue;
        }
        if (!event || typeof event !== "object") continue;
        event = { ...event, type: (event.type ?? msg.event) as StreamEvent["type"] };
        const terminal = apply(event);
        if (terminal) {
          stop();
          return terminal;
        }
        if (!isCurrent()) {
          stop();
          return signal?.aborted ? interrupted() : { status: "stale" };
        }
      }
    }
  } catch {
    if (signal?.aborted) return interrupted();
    return {
      status: "failed",
      error: "stream_disconnected",
      fallbackToClassic: false,
      userMessage,
    };
  } finally {
    parser.end();
  }

  if (signal?.aborted) return interrupted();
  // The server always ends with a terminal event; EOF without one means the
  // connection dropped mid-turn. The partial text is not a reply.
  return {
    status: "failed",
    error: "stream_incomplete",
    fallbackToClassic: false,
    userMessage,
  };
}

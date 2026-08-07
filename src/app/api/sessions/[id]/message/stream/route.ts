/**
 * Stage 11 — Streaming patient turn (SSE).
 *
 * Cognition + persistence remain owned by POST /api/sessions/:id/message.
 * This route is a presentation adapter: it invokes the classic turn, then
 * progressively emits tokens for partial rendering / incremental speech, with
 * interrupt + network-recovery events.
 *
 * Never writes ClinicalCore. Never forks patient engines.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  createSseResponse,
  encodeSse,
  isRealtimeStreamingEnabled,
  progressiveTokens,
} from "@/lib/realtime";
import { realtimeMetrics } from "@/lib/realtime/observability";
import { POST as classicMessagePost } from "../route";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Params) {
  if (!isRealtimeStreamingEnabled()) {
    return NextResponse.json(
      { error: "Realtime streaming is not enabled" },
      { status: 404 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`msg-stream:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { message?: string; therapistInterrupted?: boolean };
  try {
    body = (await request.json()) as {
      message?: string;
      therapistInterrupted?: boolean;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const { id: sessionId } = await ctx.params;
  const abort = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let seq = 0;
      const send = (
        type: string,
        payload?: Record<string, unknown>,
      ) => {
        controller.enqueue(
          encoder.encode(
            encodeSse({
              type: type as
                | "status"
                | "token"
                | "partial"
                | "done"
                | "error"
                | "interrupted",
              ts: Date.now(),
              sequence: ++seq,
              payload,
            }),
          ),
        );
      };

      try {
        send("status", { status: "preparing", sessionId });
        const t0 = Date.now();

        const classicReq = new Request(request.url.replace(/\/stream$/, ""), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            cookie: request.headers.get("cookie") ?? "",
          },
          body: JSON.stringify({
            message,
            therapistInterrupted: Boolean(body.therapistInterrupted),
          }),
          signal: abort,
        });

        send("status", { status: "awaiting_model" });
        const classicRes = await classicMessagePost(classicReq, ctx);
        const payload = (await classicRes.json()) as Record<string, unknown>;

        if (!classicRes.ok) {
          realtimeMetrics.record({
            kind: "speech_failure",
            sessionId,
            detail: `message_${classicRes.status}`,
          });
          send("error", {
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Turn failed",
            status: classicRes.status,
          });
          controller.close();
          return;
        }

        realtimeMetrics.recordLatency(
          {
            stage: "llm_ttfb",
            ms: Date.now() - t0,
            ok: true,
            at: new Date().toISOString(),
          },
          sessionId,
        );

        const assistant = payload.assistantMessage as
          | { content?: string }
          | undefined;
        const text = assistant?.content?.trim() ?? "";

        if (abort.aborted) {
          realtimeMetrics.record({
            kind: "stream_interrupt",
            sessionId,
            detail: "client_abort_before_reveal",
          });
          send("interrupted", { text });
          controller.close();
          return;
        }

        send("status", { status: "streaming_tokens" });
        let acc = "";
        for (const token of progressiveTokens(text, 3)) {
          if (abort.aborted) {
            realtimeMetrics.record({
              kind: "stream_interrupt",
              sessionId,
              detail: "client_abort_during_reveal",
            });
            send("interrupted", { text: acc });
            controller.close();
            return;
          }
          acc += token;
          send("token", { token, text: acc });
          send("partial", { text: acc });
        }

        send("done", {
          ...payload,
          streamed: true,
          interrupted: false,
        });
        controller.close();
      } catch (err) {
        if (abort.aborted) {
          send("interrupted", { reason: "aborted" });
        } else {
          send("error", {
            message:
              err instanceof Error ? err.message : "Streaming turn failed",
          });
        }
        controller.close();
      }
    },
  });

  return createSseResponse(stream);
}

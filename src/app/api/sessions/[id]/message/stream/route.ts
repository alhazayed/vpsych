/**
 * Stage 11 — realtime patient turn over SSE (true LLM token streaming).
 *
 * Same auth, ownership, session and expiry checks as POST /message, and the
 * same cognition: `prepareClinicalTurn` (Adaptation → Memory → Emotion → CBE →
 * PatientDecisionPlan → Humanization) and the same canonical gate +
 * persistence (`generateValidatedReply` / `persistAssistantReply`) from
 * `@/lib/sessions/clinical-turn`. Only the drafting transport differs: tokens
 * come from `generatePatientReplyStream` as the model produces them.
 *
 * Every pre-generation failure answers with the same HTTP status + JSON body
 * as /message BEFORE any SSE byte is sent and before the therapist message is
 * persisted, so the client can safely fall back to the classic route.
 *
 * Classic /message remains the clinical source of truth and fallback.
 * Never writes ClinicalCore. Never forks patient engines.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import {
  createSseResponse,
  encodeSse,
  isRealtimeStreamingEnabled,
  isTherapyRoomStreamingEnabled,
} from "@/lib/realtime";
import { realtimeMetrics } from "@/lib/realtime/observability";
import type { StreamEventType } from "@/lib/realtime/types";
import {
  parseTurnMessage,
  prepareClinicalTurn,
} from "@/lib/sessions/clinical-turn";
import { runStreamingClinicalTurn } from "@/lib/sessions/stream-turn";

// Time budget: lib/ai/time-budget.ts (SESSION_ROUTE_MAX_DURATION_SEC).
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/** Client-supplied turn id echoed on every event (stale-turn fencing). */
function sanitizeClientTurnId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null;
}

export async function POST(request: Request, ctx: Params) {
  if (!isRealtimeStreamingEnabled() && !isTherapyRoomStreamingEnabled()) {
    return NextResponse.json(
      { error: "Realtime streaming is not enabled" },
      { status: 404 },
    );
  }

  const requestId = resolveRequestId(request);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: requestIdHeaders(requestId) },
    );
  }

  const limited = await rateLimit(`msg-stream:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec),
          ...requestIdHeaders(requestId),
        },
      },
    );
  }

  let body: {
    message?: string;
    therapistInterrupted?: boolean;
    clientTurnId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseTurnMessage(body);
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status });
  }

  const { id: sessionId } = await ctx.params;

  const prepared = await prepareClinicalTurn({
    supabase,
    userId: user.id,
    sessionId,
    message: parsed.message,
    therapistInterrupted: Boolean(body.therapistInterrupted),
  });
  if (!prepared.ok) {
    return NextResponse.json(prepared.body, { status: prepared.status });
  }

  const turnId = sanitizeClientTurnId(body.clientTurnId) ?? crypto.randomUUID();

  // One controller per turn: aborted by client disconnect (request.signal)
  // or by the stream being cancelled. Passed down to the LLM request.
  const abort = new AbortController();
  const onRequestAbort = () => abort.abort();
  if (request.signal.aborted) abort.abort();
  else request.signal.addEventListener("abort", onRequestAbort, { once: true });

  const t0 = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let sequence = 0;
      let closed = false;
      let firstToken = true;

      const emit = (type: StreamEventType, payload: Record<string, unknown>) => {
        if (closed) return;
        if (type === "token" && firstToken) {
          firstToken = false;
          realtimeMetrics.recordLatency(
            {
              stage: "llm_ttfb",
              ms: Date.now() - t0,
              ok: true,
              at: new Date().toISOString(),
            },
            sessionId,
          );
        }
        try {
          controller.enqueue(
            encoder.encode(
              encodeSse({
                type,
                ts: Date.now(),
                sequence: ++sequence,
                payload: { turnId, ...payload },
              }),
            ),
          );
        } catch {
          // Consumer went away: stop generating.
          closed = true;
          abort.abort();
        }
      };

      void runStreamingClinicalTurn({
        turn: prepared.turn,
        signal: abort.signal,
        emit,
      })
        .then((outcome) => {
          if (outcome === "interrupted") {
            realtimeMetrics.record({
              kind: "stream_interrupt",
              sessionId,
              detail: "client_abort_during_generation",
            });
          } else if (outcome === "error") {
            realtimeMetrics.record({
              kind: "speech_failure",
              sessionId,
              detail: "stream_turn_error",
            });
          }
        })
        .catch((err) => {
          // runStreamingClinicalTurn never throws; defensive only.
          console.error("[sessions/message/stream] turn failed", {
            sessionId,
            error: err instanceof Error ? err.name : "unknown",
          });
          emit("error", {
            message: "Streaming turn failed",
            assistantPersisted: false,
          });
        })
        .finally(() => {
          closed = true;
          request.signal.removeEventListener("abort", onRequestAbort);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        });
    },
    cancel() {
      abort.abort();
    },
  });

  return createSseResponse(stream, requestIdHeaders(requestId));
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePatientReplyDetailed } from "@/lib/ai/patient-agent";
import { rateLimit } from "@/lib/rate-limit";
import { resolveRequestId, requestIdHeaders } from "@/lib/request-id";
import { clientSafeError } from "@/lib/api-errors";
import {
  buildTurnResponse,
  generateValidatedReply,
  logAssistantReply,
  parseTurnMessage,
  persistAssistantReply,
  prepareClinicalTurn,
  type ReplyDraftGenerator,
} from "@/lib/sessions/clinical-turn";

// Time budget: lib/ai/time-budget.ts (SESSION_ROUTE_MAX_DURATION_SEC).
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/** Classic (blocking) drafting: the authoritative, non-streaming generator. */
const classicDraft: ReplyDraftGenerator = ({
  avatar,
  history,
  userMessage,
  behaviourReinforcement,
}) =>
  generatePatientReplyDetailed({
    avatar,
    history,
    userMessage,
    behaviourReinforcement,
  });

/**
 * Classic patient turn — the clinical source of truth and the fallback for the
 * realtime stream route. Cognition lives in `@/lib/sessions/clinical-turn`,
 * shared verbatim with /message/stream.
 */
export async function POST(request: Request, { params }: Params) {
  const requestId = resolveRequestId(request);
  const { id: sessionId } = await params;
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

  const limited = await rateLimit(`msg:${user.id}`, 120, 60 * 60 * 1000);
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

  const body = (await request.json()) as {
    message?: string;
    /** True when the therapist barge-in / cut off the prior patient turn. */
    therapistInterrupted?: boolean;
  };
  const parsed = parseTurnMessage(body);
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status });
  }

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
  const turn = prepared.turn;

  let replyMeta: Awaited<ReturnType<typeof generateValidatedReply>>;
  try {
    replyMeta = await generateValidatedReply(turn, classicDraft);
  } catch (err) {
    console.error("[sessions/message] patient reply generation failed", {
      sessionId,
      language: turn.session.language,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to generate patient reply" },
      { status: 502 },
    );
  }

  logAssistantReply(turn, replyMeta, "classic");

  const saved = await persistAssistantReply(turn, replyMeta.text);
  if (!saved.ok) {
    return NextResponse.json(
      { error: clientSafeError("Failed to save reply", saved.error) },
      { status: 500 },
    );
  }

  const response = buildTurnResponse(turn, replyMeta, saved.assistantMsg);
  return NextResponse.json(response.body, {
    headers: {
      ...response.headers,
      ...requestIdHeaders(requestId),
    },
  });
}

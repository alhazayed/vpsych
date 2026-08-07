import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { messageRpcClient } from "@/lib/supabase/admin";
import { generatePatientReplyDetailed } from "@/lib/ai/patient-agent";
import { resolveAvatar } from "@/lib/avatars/resolve";
import {
  buildHumanizationTurn,
  toClientHints,
} from "@/lib/humanization";
import { remainingSeconds } from "@/lib/session-timer";
import { expireStaleSession } from "@/lib/session-expiry";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";
import { MAX_SESSION_SECONDS } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`msg:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as { message?: string };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: "message too long (max 4000 characters)" },
      { status: 400 },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, avatars(*, voice_profile:voice_profiles(*))")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as TherapySession & { avatars: Avatar };
  if (typed.therapist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (typed.status !== "active") {
    return NextResponse.json({ error: "Session is not active" }, { status: 409 });
  }

  const remaining = remainingSeconds(typed.started_at, typed.max_duration_sec);
  if (remaining <= 0) {
    await expireStaleSession(supabase, typed);
    return NextResponse.json(
      { error: "Session time expired", expired: true },
      { status: 409 },
    );
  }

  // Case Engine: diagnosis from immutable session snapshot when present.
  const resolved = resolveAvatar(typed.avatars, typed.language, {
    caseSnapshot: typed.clinical_snapshot,
  });

  const { data: userMsg, error: userMsgError } = await supabase
    .from("session_messages")
    .insert({
      session_id: sessionId,
      role: "user",
      content: message,
    })
    .select("*")
    .single();

  if (userMsgError || !userMsg) {
    console.error("[sessions/message] user message save failed", {
      sessionId,
      error: userMsgError?.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to save message", userMsgError) },
      { status: 500 },
    );
  }

  const { data: history } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const typedHistory = (history ?? []) as Pick<
    SessionMessage,
    "role" | "content"
  >[];

  // Mission 10 — Humanization Layer (Emotion / Behavior / Memory / Voice).
  let caseMemory: Record<string, unknown> | null = null;
  if (typed.case_instance_id) {
    const { data: memRow } = await supabase
      .from("case_memory")
      .select("memory")
      .eq("case_instance_id", typed.case_instance_id)
      .maybeSingle();
    if (memRow?.memory && typeof memRow.memory === "object") {
      caseMemory = memRow.memory as Record<string, unknown>;
    }
  }

  const maxDur = typed.max_duration_sec ?? MAX_SESSION_SECONDS;
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(typed.started_at).getTime()) / 1000),
  );

  const humanization = buildHumanizationTurn({
    sessionId,
    caseSnapshot: typed.clinical_snapshot ?? null,
    clinicalCore: typed.clinical_snapshot?.clinical_core ?? null,
    history: typedHistory,
    userMessage: message,
    sessionLanguage: typed.language ?? "en",
    elapsedSeconds,
    maxDurationSec: maxDur,
    caseMemory,
  });

  const avatarForTurn = humanization
    ? {
        ...resolved,
        system_prompt: `${resolved.system_prompt}\n\n${humanization.prompt_cue}`,
        per_turn_reinforcement: [
          resolved.per_turn_reinforcement?.trim(),
          humanization.per_turn_cue,
        ]
          .filter(Boolean)
          .join("\n"),
      }
    : resolved;

  let replyMeta: Awaited<ReturnType<typeof generatePatientReplyDetailed>>;
  try {
    replyMeta = await generatePatientReplyDetailed({
      avatar: avatarForTurn,
      history: typedHistory,
      userMessage: message,
    });
  } catch (err) {
    console.error("[sessions/message] patient reply generation failed", {
      sessionId,
      language: typed.language,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to generate patient reply" },
      { status: 502 },
    );
  }

  console.info("[sessions/message] assistant reply", {
    sessionId,
    language: typed.language,
    aiSource: replyMeta.aiSource,
    aiModel: replyMeta.model ?? null,
    errorKind: replyMeta.errorKind ?? null,
  });

  // Prefer service role; fall back to authenticated client. RPC bodies enforce
  // ownership, active status, and "assistant after user" turn order.
  const writer = messageRpcClient(supabase);
  const { data: assistantMsg, error: assistantError } = await writer.rpc(
    "insert_assistant_message",
    {
      p_session_id: sessionId,
      p_content: replyMeta.text,
    },
  );

  if (assistantError || !assistantMsg) {
    console.error("[sessions/message] assistant message save failed", {
      sessionId,
      error: assistantError?.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Failed to save reply", assistantError) },
      { status: 500 },
    );
  }

  const humanizationHints = humanization ? toClientHints(humanization) : null;

  return NextResponse.json(
    {
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      remainingSeconds: remainingSeconds(
        typed.started_at,
        typed.max_duration_sec,
      ),
      // Additive: session language used for this turn (AR/EN pipeline).
      locale: typed.language ?? resolved.language,
      // Additive observability — never hide persona fallback usage.
      aiSource: replyMeta.aiSource,
      aiModel: replyMeta.model ?? null,
      aiErrorKind: replyMeta.errorKind ?? null,
      // Mission 10 — Humanization Engine (additive; clients may ignore).
      humanizationEnabled: Boolean(humanization),
      humanization: humanizationHints,
      voiceHints: humanizationHints?.voiceHints ?? null,
    },
    {
      headers: {
        "X-AI-Source": replyMeta.aiSource,
        ...(replyMeta.model ? { "X-AI-Model": replyMeta.model } : {}),
        ...(replyMeta.errorKind
          ? { "X-AI-Error-Kind": replyMeta.errorKind }
          : {}),
        ...(humanization
          ? { "X-Humanization": humanization.behaviors.join(",") }
          : {}),
      },
    },
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { generatePatientReplyDetailed } from "@/lib/ai/patient-agent";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { remainingSeconds } from "@/lib/session-timer";
import { expireStaleSession } from "@/lib/session-expiry";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import {
  PATIENT_HISTORY_LIMIT,
  takeRecentMessages,
} from "@/lib/session-messages";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

/** Columns required for ownership/timer checks + Case Engine resolveAvatar. */
const SESSION_MESSAGE_SELECT =
  "id, therapist_id, avatar_id, status, started_at, ended_at, created_at, max_duration_sec, language, clinical_snapshot, avatars(id, name, slug, disorder, age, gender, language, default_locale, schema_version, clinical_core, personalities, voice_id, voice_id_ar, voice_profile_id, persona_prompt, ideal_guidelines, rubric, voice_profile:voice_profiles(*))";

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
    .select(SESSION_MESSAGE_SELECT)
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as unknown as TherapySession & { avatars: Avatar };
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
    .select("id, role, content, created_at, session_id")
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

  // Newest-first page, then reverse — avoids loading full long transcripts.
  const { data: recentDesc } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(PATIENT_HISTORY_LIMIT);

  const history = takeRecentMessages(
    [...(recentDesc ?? [])].reverse(),
    PATIENT_HISTORY_LIMIT,
  );

  let replyMeta: Awaited<ReturnType<typeof generatePatientReplyDetailed>>;
  try {
    replyMeta = await generatePatientReplyDetailed({
      avatar: resolved,
      history: history as Pick<SessionMessage, "role" | "content">[],
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

  // Privileged insert — RPC is revoked from authenticated (prevents transcript forge).
  const privileged = createServiceClient();
  if (!privileged) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }
  const { data: assistantMsg, error: assistantError } = await privileged.rpc(
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
    },
    {
      headers: {
        "X-AI-Source": replyMeta.aiSource,
        ...(replyMeta.model ? { "X-AI-Model": replyMeta.model } : {}),
        ...(replyMeta.errorKind
          ? { "X-AI-Error-Kind": replyMeta.errorKind }
          : {}),
      },
    },
  );
}

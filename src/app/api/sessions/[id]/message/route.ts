import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePatientReply } from "@/lib/ai/patient-agent";
import { resolveAvatar } from "@/lib/avatars/resolve";
import { remainingSeconds } from "@/lib/session-timer";
import { rateLimit } from "@/lib/rate-limit";
import type { Avatar, SessionMessage, TherapySession } from "@/lib/types";

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

  const limited = rateLimit(`msg:${user.id}`, 120, 60 * 60 * 1000);
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
    .select("*, avatars(*)")
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
    return NextResponse.json(
      { error: "Session time expired", expired: true },
      { status: 409 },
    );
  }

  // Load multilingual prompt from clinical_core + personality for session.language.
  const resolved = resolveAvatar(typed.avatars, typed.language);

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
    return NextResponse.json(
      { error: userMsgError?.message ?? "Failed to save message" },
      { status: 500 },
    );
  }

  const { data: history } = await supabase
    .from("session_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  let reply: string;
  try {
    reply = await generatePatientReply({
      avatar: resolved,
      history: (history ?? []) as Pick<SessionMessage, "role" | "content">[],
      userMessage: message,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate patient reply" },
      { status: 502 },
    );
  }

  const { data: assistantMsg, error: assistantError } = await supabase.rpc(
    "insert_assistant_message",
    {
      p_session_id: sessionId,
      p_content: reply,
    },
  );

  if (assistantError || !assistantMsg) {
    return NextResponse.json(
      { error: assistantError?.message ?? "Failed to save reply" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    remainingSeconds: remainingSeconds(typed.started_at, typed.max_duration_sec),
  });
}

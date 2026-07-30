import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePatientReply } from "@/lib/ai/patient-agent";
import { remainingSeconds } from "@/lib/session-timer";
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

  const body = (await request.json()) as { message?: string };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
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

  const reply = await generatePatientReply({
    avatar: typed.avatars,
    history: (history ?? []) as Pick<SessionMessage, "role" | "content">[],
    userMessage: message,
  });

  const { data: assistantMsg, error: assistantError } = await supabase
    .from("session_messages")
    .insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
    })
    .select("*")
    .single();

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

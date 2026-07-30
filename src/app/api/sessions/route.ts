import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_SESSION_SECONDS } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { avatarId?: string };
  if (!body.avatarId) {
    return NextResponse.json({ error: "avatarId required" }, { status: 400 });
  }

  const { data: avatar, error: avatarError } = await supabase
    .from("avatars")
    .select("id, is_active")
    .eq("id", body.avatarId)
    .single();

  if (avatarError || !avatar?.is_active) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      therapist_id: user.id,
      avatar_id: body.avatarId,
      status: "active",
      max_duration_sec: MAX_SESSION_SECONDS,
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create session" },
      { status: 500 },
    );
  }

  await supabase.from("session_messages").insert({
    session_id: session.id,
    role: "system",
    content: "Session started. Speak with the patient avatar.",
  });

  return NextResponse.json({ sessionId: session.id });
}

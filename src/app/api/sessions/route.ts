import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_SESSION_SECONDS, type Avatar } from "@/lib/types";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeAvatarLocale } from "@/lib/avatars/resolve";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`start:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as {
    avatarId?: string;
    locale?: string;
    language?: string;
  };
  if (!body.avatarId) {
    return NextResponse.json({ error: "avatarId required" }, { status: 400 });
  }

  const { data: avatar, error: avatarError } = await supabase
    .from("avatars")
    .select(
      "id, is_active, default_locale, language, schema_version, personalities",
    )
    .eq("id", body.avatarId)
    .single();

  if (avatarError || !avatar?.is_active) {
    return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
  }

  const typedAvatar = avatar as Pick<
    Avatar,
    | "id"
    | "is_active"
    | "default_locale"
    | "language"
    | "schema_version"
    | "personalities"
  >;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();

  const sessionLocale = normalizeAvatarLocale(
    body.locale ?? body.language ?? profile?.preferred_language,
    normalizeAvatarLocale(
      typedAvatar.default_locale ?? typedAvatar.language,
      "en-US",
    ),
  );

  const { data: session, error } = await supabase
    .from("sessions")
    .insert({
      therapist_id: user.id,
      avatar_id: body.avatarId,
      status: "active",
      max_duration_sec: MAX_SESSION_SECONDS,
      language: sessionLocale,
    })
    .select("id")
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create session" },
      { status: 500 },
    );
  }

  const { error: sysErr } = await supabase.rpc("insert_system_message", {
    p_session_id: session.id,
    p_content: "Session started. Speak with the patient avatar.",
  });

  if (sysErr) {
    return NextResponse.json({ error: sysErr.message }, { status: 500 });
  }

  return NextResponse.json({
    sessionId: session.id,
    locale: sessionLocale,
  });
}

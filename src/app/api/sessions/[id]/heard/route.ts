import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";

type Props = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record how much of a patient reply the therapist heard before barging in.
 * Set once per message by `mark_assistant_message_heard`, which re-checks
 * ownership, role and active status. Assessment then judges only the heard
 * part (`lib/sessions/heard-text.ts`).
 */
export async function POST(request: Request, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`heard:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { messageId?: unknown; heardChars?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const messageId = typeof body.messageId === "string" ? body.messageId : "";
  const heardChars = body.heardChars;
  if (
    !UUID_RE.test(id) ||
    !UUID_RE.test(messageId) ||
    typeof heardChars !== "number" ||
    !Number.isInteger(heardChars) ||
    heardChars < 0 ||
    heardChars > 8000
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabase
    .from("session_messages")
    .select("id, session_id")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError) {
    console.error("[heard] message read failed", {
      sessionId: id,
      messageId,
      error: messageError.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not record the interruption", messageError) },
      { status: 503 },
    );
  }
  if (!message || message.session_id !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase.rpc("mark_assistant_message_heard", {
    p_message_id: messageId,
    p_heard_chars: heardChars,
  });
  if (error) {
    console.warn("[heard] not recorded", {
      sessionId: id,
      messageId,
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not record the interruption", error) },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, recorded: data === true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import type { TherapySession } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Persist Therapy Room immersion metrics only.
 * Private notes use POST/PATCH /api/sessions/[id]/notes (session_private_notes).
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`trm:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, therapist_id, status")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const typed = session as Pick<TherapySession, "id" | "therapist_id" | "status">;
  if (typed.therapist_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    immersionMetrics?: unknown;
  };

  if (body.immersionMetrics == null || typeof body.immersionMetrics !== "object") {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("sessions")
    .update({ immersion_metrics: body.immersionMetrics })
    .eq("id", sessionId);

  if (error) {
    if (/immersion_metrics|interaction_mode/i.test(error.message)) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    console.error("[therapy-room] patch failed", { error: error.message });
    return NextResponse.json(
      { error: clientSafeError("Failed to save therapy room data", error) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

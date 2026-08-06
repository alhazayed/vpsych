import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import type { TherapySession } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Persist Therapy Room private notes + immersion metrics.
 * Notes never flow into the patient agent — this route only writes session columns.
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
    privateNotes?: unknown;
    immersionMetrics?: unknown;
  };

  const patch: Record<string, unknown> = {};

  if (typeof body.privateNotes === "string") {
    patch.private_notes = body.privateNotes.slice(0, 20000);
  }

  if (body.immersionMetrics != null && typeof body.immersionMetrics === "object") {
    patch.immersion_metrics = body.immersionMetrics;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("sessions")
    .update(patch)
    .eq("id", sessionId);

  if (error) {
    // Column may be missing if migration not applied — soft-fail for classic deploys.
    if (/private_notes|immersion_metrics|interaction_mode/i.test(error.message)) {
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

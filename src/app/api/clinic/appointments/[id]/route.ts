import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTherapyRoomEnabled } from "@/lib/features";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { isAppointmentStatus, isUuid } from "@/lib/therapy-room";

type Props = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Props) {
  if (!isTherapyRoomEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`clinic-appt:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    status?: unknown;
    sessionId?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.status !== undefined && !isAppointmentStatus(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (
    body.sessionId !== undefined &&
    body.sessionId !== null &&
    !isUuid(body.sessionId)
  ) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  // An appointment may only point at one of the therapist's own sessions.
  if (typeof body.sessionId === "string") {
    const { data: ownSession } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", body.sessionId)
      .eq("therapist_id", user.id)
      .maybeSingle();
    if (!ownSession) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status !== undefined) patch.status = body.status;
  if (body.sessionId !== undefined) patch.session_id = body.sessionId;

  const { data, error } = await supabase
    .from("clinic_appointments")
    .update(patch)
    .eq("id", id)
    .eq("therapist_id", user.id)
    .select("id, status, session_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Update failed", error) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, appointment: data });
}

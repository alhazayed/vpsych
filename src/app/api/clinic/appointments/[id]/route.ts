import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTherapyRoomEnabled } from "@/lib/features";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";

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

  const body = (await request.json()) as {
    status?: string;
    sessionId?: string | null;
  };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status) patch.status = body.status;
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

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTherapyRoomEnabled } from "@/lib/features";
import { rateLimit } from "@/lib/rate-limit";
import { closeClinicDay } from "@/lib/therapy-room/close-day";

type Props = { params: Promise<{ id: string }> };

/** Close clinic day and return end-of-day summary. */
export async function POST(_request: Request, { params }: Props) {
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

  const limited = await rateLimit(`clinic-close:${user.id}`, 20, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const result = await closeClinicDay(supabase, {
    dayId: id,
    therapistId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, summary: result.summary });
}

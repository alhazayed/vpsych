import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { requireApiSupervisor } from "@/lib/skill-tests/access";
import { isUuid } from "@/lib/skill-tests";

type Params = { params: Promise<{ id: string }> };

/** Assigning supervisor (or admin) cancels an open skill test. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const auth = await requireApiSupervisor(request, {
    action: "skill_test.cancel",
    resourceId: id,
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`skilltest:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  const { error } = await supabase.rpc("cancel_skill_test", {
    p_assignment_id: id,
  });
  if (error) {
    if (/skill_test_closed/.test(error.message)) {
      return NextResponse.json(
        { error: "This test is already closed.", code: "skill_test_closed" },
        { status: 409 },
      );
    }
    if (/forbidden/.test(error.message)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: clientSafeError("Could not cancel the test", error) },
      { status: 500 },
    );
  }

  await logSecurityEvent({
    action: "skill_test.cancel",
    outcome: "success",
    resourceType: "skill_test",
    resourceId: id,
    request,
  });
  return NextResponse.json({ ok: true });
}

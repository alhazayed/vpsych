import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { isUuid } from "@/lib/skill-tests";

/** Superadmin grants or revokes the supervisor role. */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.supervisor.change",
    resourceType: "supervisor",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-supervisor:${user.id}`, 60, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { userId?: unknown; grant?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isUuid(body.userId) || typeof body.grant !== "boolean") {
    return NextResponse.json(
      { error: "userId and grant are required" },
      { status: 400 },
    );
  }
  const userId = body.userId;

  // RLS can filter a write to zero rows without an error (for example an
  // admin token without two-step login), so both paths read back what they
  // changed. "Saved" and the audit event only follow a real change.
  let error: { message: string } | null = null;
  let applied = false;
  if (body.grant) {
    const upsert = await supabase
      .from("supervisors")
      .upsert(
        { user_id: userId, granted_by: user.id },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    error = upsert.error;
    if (!error) {
      const check = await supabase
        .from("supervisors")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      error = check.error;
      applied = Boolean(check.data);
    }
  } else {
    const removed = await supabase
      .from("supervisors")
      .delete()
      .eq("user_id", userId)
      .select("user_id");
    error = removed.error;
    applied = (removed.data?.length ?? 0) > 0;
  }

  if (error) {
    console.error("[admin/supervisors] update failed", {
      userId,
      grant: body.grant,
      error: error.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not update the supervisor role", error) },
      { status: 500 },
    );
  }
  if (!applied) {
    console.error("[admin/supervisors] change not applied", {
      userId,
      grant: body.grant,
    });
    return NextResponse.json(
      {
        error: "Could not update the supervisor role",
        code: "SUPERVISOR_NOT_UPDATED",
      },
      { status: 409 },
    );
  }

  await logSecurityEvent({
    action: body.grant ? "admin.supervisor.grant" : "admin.supervisor.revoke",
    outcome: "success",
    resourceType: "supervisor",
    resourceId: userId,
    request,
  });
  return NextResponse.json({ ok: true, userId, isSupervisor: body.grant });
}

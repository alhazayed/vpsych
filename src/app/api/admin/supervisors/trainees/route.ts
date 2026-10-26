import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { isUuid } from "@/lib/skill-tests";

/**
 * Superadmin links a supervisor to a trainee (or removes the link). A linked
 * supervisor reads and reviews that trainee's practice reports.
 */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.supervisor_trainee.change",
    resourceType: "supervisor_trainee",
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

  let body: { supervisorId?: unknown; traineeId?: unknown; link?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    !isUuid(body.supervisorId) ||
    !isUuid(body.traineeId) ||
    typeof body.link !== "boolean" ||
    body.supervisorId === body.traineeId
  ) {
    return NextResponse.json(
      { error: "supervisorId, traineeId (different people) and link are required" },
      { status: 400 },
    );
  }
  const supervisorId = body.supervisorId;
  const traineeId = body.traineeId;

  // RLS can filter a write to zero rows without an error (for example an
  // admin token without two-step login), so both paths read back what they
  // changed.
  let error: { message: string; code?: string } | null = null;
  let applied = false;
  if (body.link) {
    const upsert = await supabase
      .from("supervisor_trainees")
      .upsert(
        { supervisor_id: supervisorId, trainee_id: traineeId, linked_by: user.id },
        { onConflict: "supervisor_id,trainee_id", ignoreDuplicates: true },
      );
    error = upsert.error;
    if (!error) {
      const check = await supabase
        .from("supervisor_trainees")
        .select("trainee_id")
        .eq("supervisor_id", supervisorId)
        .eq("trainee_id", traineeId)
        .maybeSingle();
      error = check.error;
      applied = Boolean(check.data);
    }
  } else {
    const removed = await supabase
      .from("supervisor_trainees")
      .delete()
      .eq("supervisor_id", supervisorId)
      .eq("trainee_id", traineeId)
      .select("trainee_id");
    error = removed.error;
    applied = (removed.data?.length ?? 0) > 0;
  }

  if (error) {
    // 23503: supervisor_id is not in public.supervisors (role revoked).
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "That person is not a supervisor", code: "NOT_SUPERVISOR" },
        { status: 409 },
      );
    }
    console.error("[admin/supervisors/trainees] update failed", {
      supervisorId,
      traineeId,
      link: body.link,
      code: error.code,
      error: error.message,
    });
    return NextResponse.json(
      { error: clientSafeError("Could not update the supervisor link", error) },
      { status: 500 },
    );
  }
  if (!applied) {
    console.error("[admin/supervisors/trainees] change not applied", {
      supervisorId,
      traineeId,
      link: body.link,
    });
    return NextResponse.json(
      { error: "Could not update the supervisor link", code: "LINK_NOT_UPDATED" },
      { status: 409 },
    );
  }

  await logSecurityEvent({
    action: body.link ? "admin.supervisor_trainee.link" : "admin.supervisor_trainee.unlink",
    outcome: "success",
    resourceType: "supervisor_trainee",
    resourceId: traineeId,
    metadata: { supervisorId },
    request,
  });
  return NextResponse.json({ ok: true, supervisorId, traineeId, linked: body.link });
}

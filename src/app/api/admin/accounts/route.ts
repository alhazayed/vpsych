import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { isUuid } from "@/lib/skill-tests";
import { parseApprovalDecision } from "@/lib/account-approval";

/** Superadmin approves or rejects an account (profiles.approval_status). */
export async function POST(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.account.approval",
    resourceType: "profile",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-account-approval:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { userId?: unknown; decision?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = parseApprovalDecision(body.decision);
  if (!isUuid(body.userId) || !status) {
    return NextResponse.json(
      { error: "userId and decision (approve | reject | pending) are required" },
      { status: 400 },
    );
  }
  const userId = body.userId;
  if (userId === user.id) {
    return NextResponse.json(
      { error: "You cannot change your own account approval" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      approval_status: status,
      approval_decided_by: user.id,
      approval_decided_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .neq("role", "admin")
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not update the account", error) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Account not found" },
      { status: 404 },
    );
  }

  await logSecurityEvent({
    action: `admin.account.${status}`,
    outcome: "success",
    resourceType: "profile",
    resourceId: userId,
    request,
  });
  return NextResponse.json({ ok: true, userId, approvalStatus: status });
}

import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { clientSafeError } from "@/lib/api-errors";
import { logSecurityEvent } from "@/lib/security-audit";
import { isUuid } from "@/lib/skill-tests";
import {
  classifyDeleteAccountError,
  parseAccountEdit,
  parseApprovalDecision,
} from "@/lib/account-approval";

function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests", retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

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

/** Admin edits another account's display name and/or role. */
export async function PATCH(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.account.edit",
    resourceType: "profile",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-account-edit:${user.id}`, 120, 60 * 60 * 1000);
  if (!limited.ok) return tooMany(limited.retryAfterSec);

  const body = await readJson<{ userId?: unknown; displayName?: unknown; role?: unknown }>(
    request,
  );
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  if (!isUuid(body.userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const parsed = parseAccountEdit(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const userId = body.userId;
  const { edit } = parsed;
  // An admin may rename themselves but never change their own role, so the
  // console can't be left without the admin who is using it.
  if (edit.role !== undefined && userId === user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 },
    );
  }

  const update: { display_name?: string; role?: "therapist" | "admin" } = {};
  if (edit.displayName !== undefined) update.display_name = edit.displayName;
  if (edit.role !== undefined) update.role = edit.role;

  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", userId)
    .select("id, display_name, role")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: clientSafeError("Could not update the account", error) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await logSecurityEvent({
    action: edit.role !== undefined ? `admin.account.role.${edit.role}` : "admin.account.edit",
    outcome: "success",
    resourceType: "profile",
    resourceId: userId,
    request,
  });
  return NextResponse.json({ ok: true, account: data });
}

/** Admin permanently deletes another account (admin_delete_account RPC). */
export async function DELETE(request: Request) {
  const auth = await requireApiAdmin(request, {
    action: "admin.account.delete",
    resourceType: "profile",
  });
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const limited = await rateLimit(`admin-account-delete:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) return tooMany(limited.retryAfterSec);

  const body = await readJson<{ userId?: unknown }>(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  if (!isUuid(body.userId)) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const userId = body.userId;
  if (userId === user.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account", code: "SELF" },
      { status: 400 },
    );
  }

  const { error } = await supabase.rpc("admin_delete_account", { target_id: userId });
  if (error) {
    const { status, code } = classifyDeleteAccountError(error);
    await logSecurityEvent({
      action: "admin.account.delete",
      outcome: "failure",
      resourceType: "profile",
      resourceId: userId,
      request,
    });
    return NextResponse.json(
      {
        error:
          status === 500
            ? clientSafeError("Could not delete the account", error)
            : "Could not delete the account",
        code,
      },
      { status },
    );
  }

  await logSecurityEvent({
    action: "admin.account.delete",
    outcome: "success",
    resourceType: "profile",
    resourceId: userId,
    request,
  });
  return NextResponse.json({ ok: true, userId });
}

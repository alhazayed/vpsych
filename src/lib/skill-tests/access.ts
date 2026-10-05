/**
 * Supervisor access checks. The superadmin (profiles.role = 'admin') keeps
 * full access, including admin MFA; a supervisor is a user listed in
 * public.supervisors. RLS repeats every check on the data itself.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requireAdmin, requireProfile } from "@/lib/auth";
import {
  requireApiAdmin,
  requireApiUser,
  type ApiAuthResult,
} from "@/lib/api-auth";
import { logSecurityEvent } from "@/lib/security-audit";

/** False when the user is not a supervisor or the table is not migrated. */
export async function loadIsSupervisor(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("supervisors")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}

/** Server Component guard for supervisor pages (redirects). */
export async function requireSupervisor() {
  const ctx = await requireProfile();
  if (ctx.profile.role === "admin") {
    return { ...(await requireAdmin()), isAdmin: true as const };
  }
  if (!(await loadIsSupervisor(ctx.supabase, ctx.profile.id))) {
    await logSecurityEvent({
      action: "supervisor.access",
      outcome: "denied",
      resourceType: "route",
      metadata: { role: ctx.profile.role },
    });
    redirect("/avatars");
  }
  return { ...ctx, isAdmin: false as const };
}

/** Route Handler guard for supervisor APIs (JSON 401/403, never redirects). */
export async function requireApiSupervisor(
  request: Request,
  opts: { action: string; resourceId?: string },
): Promise<ApiAuthResult & { isAdmin?: boolean }> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;
  if (auth.profile.role === "admin") {
    const admin = await requireApiAdmin(request, {
      action: opts.action,
      resourceType: "skill_test",
      resourceId: opts.resourceId,
    });
    return admin.ok ? { ...admin, isAdmin: true } : admin;
  }
  if (!(await loadIsSupervisor(auth.supabase, auth.user.id))) {
    await logSecurityEvent({
      action: opts.action,
      outcome: "denied",
      resourceType: "skill_test",
      resourceId: opts.resourceId ?? null,
      metadata: { role: auth.profile.role, reason: "not_supervisor" },
      request,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ...auth, isAdmin: false };
}

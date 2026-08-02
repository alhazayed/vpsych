import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-audit";
import type { Profile } from "@/lib/types";

export type ApiAuthContext = {
  supabase: SupabaseClient;
  user: User;
  profile: Profile;
};

export type ApiAuthResult =
  | { ok: true; supabase: SupabaseClient; user: User; profile: Profile }
  | { ok: false; response: NextResponse };

/**
 * Authenticated Route Handler guard (JSON 401 — never redirects).
 */
export async function requireApiUser(
  request?: Request,
): Promise<ApiAuthResult> {
  void request;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    supabase,
    user,
    profile: profile as Profile,
  };
}

/**
 * Admin Route Handler guard (JSON 403 + security audit on deny).
 */
export async function requireApiAdmin(
  request?: Request,
  opts?: { action?: string; resourceType?: string; resourceId?: string },
): Promise<ApiAuthResult> {
  const auth = await requireApiUser(request);
  if (!auth.ok) return auth;

  if (auth.profile.role !== "admin") {
    await logSecurityEvent({
      action: opts?.action ?? "admin.access",
      outcome: "denied",
      resourceType: opts?.resourceType ?? "api",
      resourceId: opts?.resourceId ?? null,
      metadata: { role: auth.profile.role },
      request,
    });
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}

/** Consistent JSON error envelope for Route Handlers. */
export function apiError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extra }, { status });
}

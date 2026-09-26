import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-audit";
import {
  adminMfaChallengeHref,
  evaluateAdminMfa,
  isAdminMfaEnforced,
} from "@/lib/admin-mfa";
import type { Profile } from "@/lib/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  return { supabase, user, profile: profile as Profile };
}

/**
 * Authenticated admin identity without AAL2 — for MFA bootstrap pages only.
 * Protected admin operations must continue to use requireAdmin().
 */
export async function requireAdminIdentity() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "admin") {
    await logSecurityEvent({
      action: "admin.access",
      outcome: "denied",
      resourceType: "route",
      metadata: { role: ctx.profile.role, reason: "not_admin" },
    });
    redirect("/avatars");
  }
  return ctx;
}

async function pathForMfaRedirect(): Promise<string> {
  const h = await headers();
  const fromHeader = h.get("x-pathname");
  if (fromHeader && fromHeader.startsWith("/")) {
    return fromHeader;
  }
  return "/admin";
}

export async function requireAdmin() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "admin") {
    await logSecurityEvent({
      action: "admin.access",
      outcome: "denied",
      resourceType: "route",
      metadata: { role: ctx.profile.role },
    });
    redirect("/avatars");
  }

  if (isAdminMfaEnforced()) {
    let currentLevel: string | null = null;
    try {
      const { data } =
        await ctx.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      currentLevel = data?.currentLevel ?? null;
    } catch {
      currentLevel = null;
    }
    const mfa = evaluateAdminMfa({
      enforced: true,
      assurance: { currentLevel, nextLevel: null },
    });
    if (!mfa.ok) {
      await logSecurityEvent({
        action: "admin.access",
        outcome: "denied",
        resourceType: "route",
        metadata: {
          role: ctx.profile.role,
          reason: mfa.reason,
          currentLevel: mfa.currentLevel,
        },
      });
      // Send AAL1 admins to the in-app MFA bootstrap — never bounce via
      // /login (middleware would redirect authenticated users to /avatars).
      redirect(adminMfaChallengeHref(await pathForMfaRedirect()));
    }
  }

  return ctx;
}

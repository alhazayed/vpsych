import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-audit";
import type { Profile } from "@/lib/types";
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
  return ctx;
}

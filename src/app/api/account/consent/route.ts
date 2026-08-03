import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logSecurityEvent } from "@/lib/security-audit";
import { LEGAL_VERSION } from "@/lib/compliance/constants";
import { rateLimit } from "@/lib/rate-limit";

/**
 * PATCH consent / marketing / retention preferences on the caller's profile.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`consent:${user.id}`, 30, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    marketingOptIn?: boolean;
    acceptAiProcessing?: boolean;
    acceptTerms?: boolean;
    cookiePreferences?: { preferences?: boolean };
    dataRetentionDays?: number;
  };

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const now = new Date().toISOString();

  if (typeof body.marketingOptIn === "boolean") {
    patch.marketing_opt_in = body.marketingOptIn;
  }
  if (body.acceptTerms) {
    patch.terms_accepted_at = now;
    patch.privacy_accepted_at = now;
  }
  if (body.acceptAiProcessing) {
    patch.ai_processing_accepted_at = now;
  }
  if (body.cookiePreferences) {
    patch.cookie_preferences = {
      essential: true,
      preferences: Boolean(body.cookiePreferences.preferences),
      version: LEGAL_VERSION,
      decidedAt: now,
    };
  }
  if (typeof body.dataRetentionDays === "number") {
    const days = Math.floor(body.dataRetentionDays);
    if (days < 30 || days > 2555) {
      return NextResponse.json(
        { error: "dataRetentionDays must be between 30 and 2555" },
        { status: 400 },
      );
    }
    patch.data_retention_days = days;
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select(
      "terms_accepted_at, privacy_accepted_at, ai_processing_accepted_at, marketing_opt_in, cookie_preferences, data_retention_days, organization",
    )
    .maybeSingle();

  if (error) {
    console.error("[account/consent]", error.message);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }

  await logSecurityEvent({
    action: "compliance.consent.update",
    outcome: "success",
    resourceType: "profile",
    resourceId: user.id,
    metadata: { fields: Object.keys(patch) },
    request,
  });

  return NextResponse.json({ ok: true, profile: data });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "display_name, role, preferred_language, terms_accepted_at, privacy_accepted_at, ai_processing_accepted_at, marketing_opt_in, cookie_preferences, data_retention_days, organization, created_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  return NextResponse.json({
    email: user.email ?? null,
    profile: data,
    legalVersion: LEGAL_VERSION,
  });
}

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const OTP_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return !!value && OTP_TYPES.has(value as EmailOtpType);
}

/**
 * App-hosted auth confirmation for Send Email hook links.
 *
 * Links land here with `token_hash` + `type` so recovery never depends on
 * GoTrue's Site URL / redirect allow-list (misconfigured Site URL was sending
 * users to http://localhost:3000 → blank page).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const nextDefault =
    typeParam === "recovery" ? "/auth/reset-password" : "/avatars";
  const next = safeRedirectPath(searchParams.get("next"), nextDefault);

  if (!token_hash || !isEmailOtpType(typeParam)) {
    return NextResponse.redirect(
      new URL("/login?error=auth", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: typeParam,
    token_hash,
  });

  if (error) {
    const dest =
      typeParam === "recovery"
        ? "/login?error=recovery"
        : "/login?error=auth";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}

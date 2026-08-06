import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { NextResponse } from "next/server";

/**
 * PKCE code exchange for signup / default-mailer recovery redirects.
 * Recovery emails from the Send Email hook use /auth/confirm instead.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = safeRedirectPath(nextParam, "/avatars");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    const dest =
      nextParam && next.startsWith("/auth/reset-password")
        ? "/login?error=recovery"
        : "/login?error=auth";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}

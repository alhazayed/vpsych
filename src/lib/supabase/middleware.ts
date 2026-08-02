import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";

function applyLocaleCookie(
  response: NextResponse,
  locale: AppLocale,
) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Never send this cookie over plaintext HTTP once deployed; skip in local
    // dev where http://localhost has no TLS.
    secure: process.env.NODE_ENV === "production",
  });
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage =
    path.startsWith("/login") || path.startsWith("/signup");
  const isPublic =
    path === "/" || isAuthPage || path.startsWith("/auth/");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/avatars";
    return NextResponse.redirect(url);
  }

  // Explicit locale cookie wins. LanguageSwitcher sets the cookie immediately and
  // syncs preferred_language asynchronously — never clobber a valid cookie with a
  // stale profile value (that forced Arabic sessions back to en-US).
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  let locale: AppLocale = defaultLocale;

  if (isAppLocale(cookieLocale)) {
    locale = cookieLocale;
  } else if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", user.id)
      .maybeSingle();

    if (isAppLocale(profile?.preferred_language)) {
      locale = profile.preferred_language;
    }
  }

  if (cookieLocale !== locale) {
    applyLocaleCookie(supabaseResponse, locale);
  }

  return supabaseResponse;
}

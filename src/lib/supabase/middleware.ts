import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";
import { safeRedirectPath } from "@/lib/safe-redirect";

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
    path === "/" ||
    isAuthPage ||
    path.startsWith("/auth/") ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path === "/privacy" ||
    path === "/terms" ||
    path.startsWith("/.well-known/");

  if (!user && !isPublic) {
    // API clients need JSON 401 — never HTML login redirects.
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Preserve query string so deep links round-trip after login.
    const nextTarget = `${path}${request.nextUrl.search}`;
    url.search = "";
    url.searchParams.set("next", nextTarget);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  const isAdminPath =
    path.startsWith("/admin") || path.startsWith("/api/admin");

  // Explicit locale cookie wins. LanguageSwitcher sets the cookie immediately and
  // syncs preferred_language asynchronously — never clobber a valid cookie with a
  // stale profile value (that forced Arabic sessions back to en-US).
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  let locale: AppLocale = defaultLocale;
  let profileRole: string | null = null;

  if (user && (isAdminPath || !isAppLocale(cookieLocale))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferred_language, role")
      .eq("id", user.id)
      .maybeSingle();

    profileRole = profile?.role ?? null;

    if (!isAppLocale(cookieLocale) && isAppLocale(profile?.preferred_language)) {
      locale = profile.preferred_language;
    }
  }

  if (isAppLocale(cookieLocale)) {
    locale = cookieLocale;
  }

  // Defense-in-depth: admin UI + /api/admin require role=admin at the edge.
  if (user && isAdminPath && profileRole !== "admin") {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/avatars";
    return NextResponse.redirect(url);
  }

  if (cookieLocale !== locale) {
    applyLocaleCookie(supabaseResponse, locale);
  }

  return supabaseResponse;
}

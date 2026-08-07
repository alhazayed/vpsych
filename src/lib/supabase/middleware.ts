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

function isPublicPath(path: string): boolean {
  if (path === "/" || path.startsWith("/login") || path.startsWith("/signup")) {
    return true;
  }
  // /auth/callback, /auth/confirm, /auth/reset-password — recovery must work
  // while a recovery session exists without bouncing to /avatars.
  if (path.startsWith("/auth/")) return true;
  if (path.startsWith("/legal/")) return true;
  if (path === "/privacy" || path === "/terms") return true;
  if (path === "/validation" || path.startsWith("/validation/")) return true;
  if (path === "/api/validation/invite") return true;
  if (path === "/api/enterprise/certificates/verify") return true;
  if (path === "/robots.txt" || path === "/sitemap.xml") return true;
  if (path === "/manifest.webmanifest" || path === "/manifest.json") return true;
  if (path === "/rss.xml" || path === "/feed.xml") return true;
  if (path.startsWith("/sitemap") || path.startsWith("/sitemaps/")) return true;
  if (path.startsWith("/.well-known/")) return true;
  if (path === "/api/health") return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Liveness probe — no auth, no Supabase round-trip (SRE / CI smoke).
  if (path === "/api/health") {
    return NextResponse.next({ request });
  }

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

  const isAuthPage =
    path.startsWith("/login") || path.startsWith("/signup");
  // Authenticated users on /auth/reset-password must stay there to set a
  // password; do not treat it as an auth page bounce target.
  const isApi = path.startsWith("/api/");
  const isPublic = isPublicPath(path);

  if (!user && !isPublic) {
    // APIs return JSON 401 (not HTML login redirects) for ops/clients.
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
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

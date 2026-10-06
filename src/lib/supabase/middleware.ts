import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
  type AppLocale,
} from "@/i18n/config";
import {
  adminMfaChallengeHref,
  isAdminMfaBootstrapPath,
} from "@/lib/admin-mfa";
import { safeRedirectPath } from "@/lib/safe-redirect";
import {
  ACCOUNT_NOT_APPROVED_CODE,
  isApprovalExemptPath,
  isMissingApprovalColumnError,
  PENDING_APPROVAL_PATH,
  resolveApprovalStatus,
  type ApprovalStatus,
} from "@/lib/account-approval";

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
  // Cron routes authenticate via CRON_SECRET in the Route Handler (fail closed).
  if (path.startsWith("/api/cron/")) return true;
  return false;
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Liveness probe — no auth, no Supabase round-trip (SRE / CI smoke).
  if (path === "/api/health") {
    return NextResponse.next({ request });
  }

  // Propagate pathname so requireAdmin can preserve returnTo for MFA.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

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
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
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
  // Authenticated users on /auth/reset-password and /auth/mfa* must stay
  // there; do not treat those as auth-page bounce targets.
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

  // MFA bootstrap requires a session — send anonymous users to login.
  if (!user && isAdminMfaBootstrapPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    // Legacy deny redirect from requireAdmin: /login?mfa=required must not
    // bounce authenticated admins to /avatars — send them to MFA challenge.
    if (request.nextUrl.searchParams.get("mfa") === "required") {
      const next = safeRedirectPath(
        request.nextUrl.searchParams.get("next"),
        "/admin",
      );
      return NextResponse.redirect(
        new URL(adminMfaChallengeHref(next), request.url),
      );
    }
    const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(next, request.url));
  }

  const isAdminPath =
    path.startsWith("/admin") || path.startsWith("/api/admin");

  // Every signed-in request outside the public + auth paths needs an approved
  // account, so the profile is read for all of them (one primary-key lookup).
  const needsApproval = Boolean(user) && !isPublic && !isApprovalExemptPath(path);

  // Explicit locale cookie wins. LanguageSwitcher sets the cookie immediately and
  // syncs preferred_language asynchronously — never clobber a valid cookie with a
  // stale profile value (that forced Arabic sessions back to en-US).
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  let locale: AppLocale = defaultLocale;
  let profileRole: string | null = null;
  let approval: ApprovalStatus | "unknown" = "approved";

  if (user && (isAdminPath || needsApproval || !isAppLocale(cookieLocale))) {
    let { data: profile, error } = await supabase
      .from("profiles")
      .select("preferred_language, role, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (isMissingApprovalColumnError(error)) {
      // Approval migration not applied yet: behave exactly as before it.
      ({ data: profile, error } = await supabase
        .from("profiles")
        .select("preferred_language, role")
        .eq("id", user.id)
        .maybeSingle());
      approval = "approved";
    } else {
      approval = error ? "unknown" : resolveApprovalStatus(profile);
    }

    profileRole = profile?.role ?? null;

    if (!isAppLocale(cookieLocale) && isAppLocale(profile?.preferred_language)) {
      locale = profile.preferred_language;
    }
  }

  if (isAppLocale(cookieLocale)) {
    locale = cookieLocale;
  }

  // Unapproved (or unverifiable) accounts are confined to the pending screen.
  if (user && needsApproval && approval !== "approved") {
    if (isApi) {
      return NextResponse.json(
        approval === "unknown"
          ? { error: "Account status could not be verified" }
          : { error: "Account awaiting approval", code: ACCOUNT_NOT_APPROVED_CODE },
        { status: approval === "unknown" ? 503 : 403 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = PENDING_APPROVAL_PATH;
    url.search = "";
    return NextResponse.redirect(url);
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

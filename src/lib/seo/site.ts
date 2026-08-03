/**
 * Site URL and public crawl inventory for Technical SEO.
 */

export const SITE_NAME = "VPsych";
export const SITE_TAGLINE_EN =
  "AI patient simulations for psychiatric and psychotherapy training";
export const SITE_TAGLINE_AR =
  "محاكاة مرضى بالذكاء الاصطناعي لتدريب الطب النفسي والعلاج النفسي";

/** Absolute origin for canonicals, sitemaps, and schema. */
export function getSiteOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return fromEnv || "https://vpsych.vercel.app";
}

/** Public, indexable marketing/auth paths (never require auth). */
export const PUBLIC_INDEXABLE_PATHS = [
  "/",
  "/login",
  "/signup",
  "/site-map",
  "/about",
  "/faq",
  "/llms.txt",
  "/knowledge-graph.json",
] as const;

/** Paths that require a session (disallow in robots; noindex in app shell). */
export const PRIVATE_PATH_PREFIXES = [
  "/avatars",
  "/sessions",
  "/learning",
  "/admin",
  "/faculty",
  "/api/",
] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p),
  );
}

/** Crawlable SEO / discovery assets (must bypass auth middleware). */
export function isSeoAssetPath(pathname: string): boolean {
  if (
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/rss.xml" ||
    pathname === "/feed.xml" ||
    pathname === "/llms.txt" ||
    pathname === "/knowledge-graph.json" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/icon-32.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png"
  ) {
    return true;
  }
  if (pathname.startsWith("/.well-known/")) return true;
  if (pathname.startsWith("/sitemap")) return true;
  if (pathname.startsWith("/sitemaps/")) return true;
  return false;
}

export function absoluteUrl(path = "/"): string {
  const origin = getSiteOrigin();
  if (!path || path === "/") return origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function hreflangUrl(path: string, hl: "en" | "ar"): string {
  const base = absoluteUrl(path === "/" ? "/" : path);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}hl=${hl}`;
}

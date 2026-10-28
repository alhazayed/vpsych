/**
 * Baseline HTTP security headers applied to every response.
 * Kept as a pure data module so unit tests can assert the policy without
 * booting Next.js.
 */

export type SecurityHeader = { key: string; value: string };

/** Permissions that voice sessions need; everything else stays denied. */
export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=(self)",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "interest-cohort=()",
].join(", ");

/**
 * Content-Security-Policy tuned for the App Router + Supabase + voice APIs.
 * `'unsafe-inline'` is required by the Next.js client runtime today; tighten
 * further once nonces are wired. `'unsafe-eval'` is only needed by the dev
 * server (React Refresh), so production builds leave it out: injected script
 * cannot turn strings into code with eval() or new Function().
 */
export function buildContentSecurityPolicy(options?: {
  /** Extra connect-src hosts (e.g. analytics). */
  extraConnectSrc?: string[];
  /** Allow eval (dev server only). Defaults to true outside production. */
  allowEval?: boolean;
}): string {
  const allowEval = options?.allowEval ?? process.env.NODE_ENV !== "production";
  const connect = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.openai.com",
    // Live transcript: Realtime transcription socket (ephemeral key).
    "wss://api.openai.com",
    "https://api.elevenlabs.io",
    "https://*.vercel-insights.com",
    "https://vitals.vercel-insights.com",
    // Sentry error reporting (EU ingest region).
    "https://*.ingest.de.sentry.io",
    ...(options?.extraConnectSrc ?? []),
  ];

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${allowEval ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** Headers applied site-wide via `next.config.ts` `headers()`. */
export function securityHeaders(): SecurityHeader[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
  ];
}

import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
  supabaseConnectSources,
  PERMISSIONS_POLICY,
  securityHeaders,
} from "./security-headers";

describe("securityHeaders", () => {
  it("includes the critical defense-in-depth headers", () => {
    const map = Object.fromEntries(
      securityHeaders().map((h) => [h.key, h.value]),
    );

    expect(map["X-Content-Type-Options"]).toBe("nosniff");
    expect(map["X-Frame-Options"]).toBe("DENY");
    expect(map["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(map["Strict-Transport-Security"]).toContain("max-age=");
    expect(map["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(map["Cross-Origin-Resource-Policy"]).toBe("same-site");
    expect(map["Content-Security-Policy"]).toBeTruthy();
  });

  it("allows microphone for voice sessions but blocks camera/geo", () => {
    expect(PERMISSIONS_POLICY).toContain("microphone=(self)");
    expect(PERMISSIONS_POLICY).toContain("camera=()");
    expect(PERMISSIONS_POLICY).toContain("geolocation=()");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("leaves out unsafe-eval in production and keeps it for the dev server", () => {
    const prod = buildContentSecurityPolicy({ allowEval: false });
    expect(prod).toContain("script-src 'self' 'unsafe-inline';");
    expect(prod).not.toContain("unsafe-eval");
    expect(buildContentSecurityPolicy({ allowEval: true })).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });

  it("denies framing and objects", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("allows Supabase and voice provider connect targets", () => {
    const csp = buildContentSecurityPolicy({
      supabaseUrl: "https://abcdefghijklmnop.supabase.co",
    });
    expect(csp).toContain("https://abcdefghijklmnop.supabase.co");
    expect(csp).toContain("https://api.elevenlabs.io");
    expect(csp).toContain("https://api.openai.com");
    // Live transcript socket — OpenAI only, not a wildcard wss:.
    expect(csp).toContain("wss://api.openai.com");
    expect(csp).not.toMatch(/connect-src[^;]*\swss:(\s|;)/);
    expect(csp).toContain("media-src 'self' blob:");
  });

  it("allows the Sentry EU ingest host for error reporting", () => {
    expect(buildContentSecurityPolicy()).toContain(
      "https://*.ingest.de.sentry.io",
    );
  });
});

describe("supabaseConnectSources", () => {
  it("pins connect-src to the configured project host, not every Supabase project", () => {
    const csp = buildContentSecurityPolicy({
      supabaseUrl: "https://abcdefghijklmnop.supabase.co/",
    });
    expect(csp).toContain(
      "https://abcdefghijklmnop.supabase.co wss://abcdefghijklmnop.supabase.co",
    );
    expect(csp).not.toContain("*.supabase.co");
  });

  it("keeps a custom Supabase domain as-is", () => {
    expect(supabaseConnectSources("https://db.example.org")).toEqual([
      "https://db.example.org",
      "wss://db.example.org",
    ]);
  });

  it("falls back to the wildcard when the URL is unset, invalid or local", () => {
    const wildcard = ["https://*.supabase.co", "wss://*.supabase.co"];
    expect(supabaseConnectSources("")).toEqual(wildcard);
    expect(supabaseConnectSources("not a url")).toEqual(wildcard);
    expect(supabaseConnectSources("http://127.0.0.1:54321")).toEqual(wildcard);
  });
});

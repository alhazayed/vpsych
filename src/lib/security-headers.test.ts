import { describe, expect, it } from "vitest";
import {
  buildContentSecurityPolicy,
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
  it("denies framing and objects", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("allows Supabase and voice provider connect targets", () => {
    const csp = buildContentSecurityPolicy();
    expect(csp).toContain("https://*.supabase.co");
    expect(csp).toContain("https://api.elevenlabs.io");
    expect(csp).toContain("https://api.openai.com");
    expect(csp).toContain("media-src 'self' blob:");
  });
});

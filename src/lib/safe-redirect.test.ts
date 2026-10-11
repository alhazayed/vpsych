import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeRedirectPath("/avatars")).toBe("/avatars");
    expect(safeRedirectPath("/sessions/abc?tab=1")).toBe("/sessions/abc?tab=1");
  });

  it("falls back for empty / null / undefined", () => {
    expect(safeRedirectPath(null)).toBe("/avatars");
    expect(safeRedirectPath(undefined)).toBe("/avatars");
    expect(safeRedirectPath("")).toBe("/avatars");
  });

  it("rejects protocol-relative and absolute URLs (open redirect)", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/avatars");
    expect(safeRedirectPath("https://evil.com")).toBe("/avatars");
    expect(safeRedirectPath("/https://evil.com")).toBe("/avatars");
  });

  it("rejects backslash tricks", () => {
    expect(safeRedirectPath("/\\evil.com")).toBe("/avatars");
  });

  it("rejects tabs, newlines and other characters browsers strip", () => {
    // URL parsers drop these, so "/\t/evil.com" would become "//evil.com".
    expect(safeRedirectPath("/\t/evil.com")).toBe("/avatars");
    expect(safeRedirectPath("/\n/evil.com")).toBe("/avatars");
    expect(safeRedirectPath("/\r\n/evil.com")).toBe("/avatars");
    expect(safeRedirectPath("/%09/evil.com".replace("%09", "\t"))).toBe("/avatars");
    expect(safeRedirectPath("/\u0000/evil.com")).toBe("/avatars");
    expect(safeRedirectPath("/ /evil.com")).toBe("/avatars");
    expect(new URL(safeRedirectPath("/\t/evil.com"), "https://app.test").host).toBe("app.test");
  });

  it("keeps ordinary paths with queries and encoded characters", () => {
    expect(safeRedirectPath("/admin/accounts")).toBe("/admin/accounts");
    expect(safeRedirectPath("/training?level=2#top")).toBe("/training?level=2#top");
    expect(safeRedirectPath("/sessions/a%20b")).toBe("/sessions/a%20b");
  });

  it("honors a custom fallback", () => {
    expect(safeRedirectPath(null, "/login")).toBe("/login");
    expect(safeRedirectPath("//evil", "/login")).toBe("/login");
  });
});

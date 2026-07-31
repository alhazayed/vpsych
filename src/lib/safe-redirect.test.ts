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

  it("honors a custom fallback", () => {
    expect(safeRedirectPath(null, "/login")).toBe("/login");
    expect(safeRedirectPath("//evil", "/login")).toBe("/login");
  });
});

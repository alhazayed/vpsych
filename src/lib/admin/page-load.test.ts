import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { classifyLoadError, throwOnLoadError } from "@/lib/admin/page-load";

describe("classifyLoadError", () => {
  it("treats no error as loaded", () => {
    expect(classifyLoadError(null)).toBeNull();
    expect(classifyLoadError(undefined)).toBeNull();
  });

  it("treats a malformed id as not found", () => {
    expect(classifyLoadError({ code: "22P02", message: "invalid input syntax for type uuid" })).toBe("not_found");
  });

  it("treats every other error as a failure, not a 404", () => {
    expect(classifyLoadError({ code: "PGRST301", message: "JWT expired" })).toBe("failed");
    expect(classifyLoadError({ message: "fetch failed" })).toBe("failed");
  });
});

describe("throwOnLoadError", () => {
  it("does nothing when there is no error", () => {
    expect(() => throwOnLoadError(null, "x")).not.toThrow();
  });

  it("calls notFound for a malformed id", () => {
    expect(() => throwOnLoadError({ code: "22P02" }, "x")).toThrow("NEXT_NOT_FOUND");
  });

  it("throws a generic error without leaking the database message", () => {
    expect(() => throwOnLoadError({ message: "secret detail" }, "admin-session")).toThrow(
      "admin-session: load failed",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  publicApiError,
  sanitizeDbError,
  sanitizeProviderError,
} from "./safe-client-error";

describe("safe-client-error", () => {
  it("maps status codes to public messages", () => {
    expect(publicApiError(500)).toBe("Internal server error");
    expect(publicApiError(401)).toBe("Unauthorized");
  });

  it("never echoes database messages", () => {
    expect(sanitizeDbError('relation "secret" does not exist')).toBe(
      "Database error",
    );
  });

  it("hides provider internals by default", () => {
    expect(
      sanitizeProviderError(new Error("sk-live-abcdef quota exceeded")),
    ).toEqual({
      error: "Upstream provider error",
      code: "PROVIDER_ERROR",
    });
  });
});

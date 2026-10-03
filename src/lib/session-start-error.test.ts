import { describe, expect, it } from "vitest";
import { sessionStartErrorKey } from "@/lib/session-start-error";

describe("sessionStartErrorKey", () => {
  it("maps known statuses", () => {
    expect(sessionStartErrorKey(401)).toBe("signedOut");
    expect(sessionStartErrorKey(429)).toBe("rateLimited");
    expect(sessionStartErrorKey(404)).toBe("patientUnavailable");
    expect(sessionStartErrorKey(422)).toBe("patientUnavailable");
  });
  it("falls back to the generic message", () => {
    expect(sessionStartErrorKey(500)).toBe("failed");
    expect(sessionStartErrorKey(502)).toBe("failed");
    expect(sessionStartErrorKey(400)).toBe("failed");
  });
});

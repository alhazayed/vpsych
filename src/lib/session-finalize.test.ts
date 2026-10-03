import { describe, expect, it } from "vitest";
import { shouldOfferReportFinalize } from "@/lib/session-finalize";

const base = {
  status: "expired",
  therapistId: "u1",
  viewerId: "u1",
  roles: ["user", "assistant"],
};

describe("shouldOfferReportFinalize", () => {
  it("finalizes the owner's finished session with therapist turns", () => {
    expect(shouldOfferReportFinalize(base)).toBe(true);
    expect(shouldOfferReportFinalize({ ...base, status: "completed" })).toBe(true);
  });
  it("never runs for active sessions", () => {
    expect(shouldOfferReportFinalize({ ...base, status: "active" })).toBe(false);
  });
  it("never runs for a viewer who does not own the session (e.g. admin)", () => {
    expect(shouldOfferReportFinalize({ ...base, viewerId: "admin" })).toBe(false);
  });
  it("skips sessions with no therapist turns", () => {
    expect(shouldOfferReportFinalize({ ...base, roles: ["assistant"] })).toBe(false);
    expect(shouldOfferReportFinalize({ ...base, roles: [] })).toBe(false);
  });
});

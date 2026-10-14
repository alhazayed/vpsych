import { describe, expect, it } from "vitest";
import { sessionElapsedLabel } from "./elapsed";

describe("sessionElapsedLabel", () => {
  const start = "2026-10-14T09:00:00.000Z";

  it("shows minutes and seconds since the session started", () => {
    expect(sessionElapsedLabel(start, "2026-10-14T09:00:42.900Z")).toBe("00:42");
    expect(sessionElapsedLabel(start, "2026-10-14T09:39:59.000Z")).toBe("39:59");
  });

  it("shows a message stamped before the start as 00:00", () => {
    expect(sessionElapsedLabel(start, "2026-10-14T08:59:58.000Z")).toBe("00:00");
  });

  it("returns null for a time it cannot read", () => {
    expect(sessionElapsedLabel("", "2026-10-14T09:00:42.000Z")).toBeNull();
    expect(sessionElapsedLabel(start, "not a date")).toBeNull();
  });
});

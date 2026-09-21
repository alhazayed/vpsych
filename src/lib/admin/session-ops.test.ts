import { describe, expect, it } from "vitest";
import { formatSessionDurationDisplay } from "./session-ops";

describe("formatSessionDurationDisplay", () => {
  const start = "2026-01-01T00:00:00.000Z";
  const maxSec = 40 * 60; // 40 minutes

  it("formats completed duration from ended_at − started_at", () => {
    const d = formatSessionDurationDisplay(
      "completed",
      start,
      "2026-01-01T00:25:00.000Z",
      maxSec,
      Date.parse("2026-01-01T01:00:00.000Z"),
    );
    expect(d).toEqual({ label: "25m", stale: false });
  });

  it("shows elapsed minutes for active sessions within limit", () => {
    const now = Date.parse("2026-01-01T00:12:00.000Z");
    const d = formatSessionDurationDisplay(
      "active",
      start,
      null,
      maxSec,
      now,
    );
    expect(d).toEqual({ label: "12m", stale: false });
  });

  it("marks active past max duration as past_limit without multi-day wall clock", () => {
    const now = Date.parse("2026-01-04T12:00:00.000Z"); // days later
    const d = formatSessionDurationDisplay(
      "active",
      start,
      null,
      maxSec,
      now,
    );
    expect(d).toEqual({ label: "past_limit", stale: true });
    expect(d?.label).not.toMatch(/d|h/);
  });

  it("returns null when started_at is missing", () => {
    expect(
      formatSessionDurationDisplay("active", null, null, maxSec),
    ).toBeNull();
  });

  it("returns null for terminal rows without ended_at", () => {
    expect(
      formatSessionDurationDisplay("expired", start, null, maxSec),
    ).toBeNull();
  });
});

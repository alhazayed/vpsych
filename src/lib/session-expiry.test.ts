import { describe, expect, it, vi } from "vitest";
import { expireStaleSession, isSessionTimedOut } from "./session-expiry";

describe("isSessionTimedOut", () => {
  it("is false while time remains", () => {
    const started = "2026-01-01T00:00:00.000Z";
    const now = Date.parse("2026-01-01T00:10:00.000Z"); // 600s
    expect(isSessionTimedOut(started, 2400, now)).toBe(false);
  });

  it("is true exactly at and after max duration", () => {
    const started = "2026-01-01T00:00:00.000Z";
    expect(
      isSessionTimedOut(started, 2400, Date.parse("2026-01-01T00:40:00.000Z")),
    ).toBe(true);
    expect(
      isSessionTimedOut(started, 2400, Date.parse("2026-01-01T01:00:00.000Z")),
    ).toBe(true);
  });
});

describe("expireStaleSession", () => {
  it("no-ops when the session is not active", async () => {
    const supabase = { from: vi.fn() };
    const ok = await expireStaleSession(supabase as never, {
      id: "s1",
      status: "completed",
      started_at: "2026-01-01T00:00:00.000Z",
      max_duration_sec: 60,
      ended_at: null,
    });
    expect(ok).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("updates active timed-out sessions to expired", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "s1" }, error: null });
    const select = vi.fn(() => ({ maybeSingle }));
    const eqStatus = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqStatus }));
    const update = vi.fn(() => ({ eq: eqId }));
    const from = vi.fn(() => ({ update }));
    const supabase = { from };

    const now = new Date("2026-01-01T01:00:00.000Z");
    const ok = await expireStaleSession(
      supabase as never,
      {
        id: "s1",
        status: "active",
        started_at: "2026-01-01T00:00:00.000Z",
        max_duration_sec: 2400,
        ended_at: null,
      },
      now,
    );

    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      status: "expired",
      ended_at: "2026-01-01T00:40:00.000Z",
    });
  });
});

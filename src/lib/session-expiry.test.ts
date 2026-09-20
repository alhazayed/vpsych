import { describe, expect, it, vi } from "vitest";
import {
  expireStaleSession,
  expireStaleSessionsVisible,
  isSessionTimedOut,
} from "./session-expiry";

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

describe("expireStaleSessionsVisible", () => {
  it("returns 0 when no active rows", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const n = await expireStaleSessionsVisible({ from } as never);
    expect(n).toBe(0);
  });

  it("expires timed-out actives in the visible set", async () => {
    const listLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "s1",
          status: "active",
          started_at: "2026-01-01T00:00:00.000Z",
          max_duration_sec: 2400,
          ended_at: null,
        },
      ],
      error: null,
    });
    const order = vi.fn(() => ({ limit: listLimit }));
    const eqStatusSelect = vi.fn(() => ({ order }));
    const selectList = vi.fn(() => ({ eq: eqStatusSelect }));

    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "s1" }, error: null });
    const selectUpdate = vi.fn(() => ({ maybeSingle }));
    const eqStatusUpdate = vi.fn(() => ({ select: selectUpdate }));
    const eqId = vi.fn(() => ({ eq: eqStatusUpdate }));
    const update = vi.fn(() => ({ eq: eqId }));

    let call = 0;
    const from = vi.fn(() => {
      call += 1;
      if (call === 1) return { select: selectList };
      return { update };
    });

    const now = new Date("2026-01-01T01:00:00.000Z");
    const n = await expireStaleSessionsVisible({ from } as never, now);
    expect(n).toBe(1);
  });
});

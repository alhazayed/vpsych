import { describe, expect, it } from "vitest";
import {
  aggregateSessionStats,
  clampPage,
  parsePositiveInt,
  totalPages,
} from "./learner-ops";

describe("aggregateSessionStats", () => {
  it("aggregates statuses, reports, and last activity", () => {
    const stats = aggregateSessionStats([
      {
        status: "completed",
        started_at: "2026-01-01T00:00:00.000Z",
        ended_at: "2026-01-01T00:30:00.000Z",
        reportOverall: 40,
        hasReport: true,
      },
      {
        status: "expired",
        started_at: "2026-01-02T00:00:00.000Z",
        ended_at: "2026-01-02T00:40:00.000Z",
        reportOverall: null,
        hasReport: false,
      },
      {
        status: "active",
        started_at: "2026-01-03T00:00:00.000Z",
        ended_at: null,
        reportOverall: null,
        hasReport: false,
      },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.active).toBe(1);
    expect(stats.withReport).toBe(1);
    expect(stats.avgOverall).toBe(40);
    expect(stats.lastActiveAt).toBe("2026-01-03T00:00:00.000Z");
  });
});

describe("pagination helpers", () => {
  it("computes total pages and clamps", () => {
    expect(totalPages(0, 50)).toBe(0);
    expect(totalPages(51, 50)).toBe(2);
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(9, 3)).toBe(3);
  });

  it("parses positive ints safely", () => {
    expect(parsePositiveInt(undefined, 1)).toBe(1);
    expect(parsePositiveInt("abc", 2)).toBe(2);
    expect(parsePositiveInt("3", 1)).toBe(3);
  });
});

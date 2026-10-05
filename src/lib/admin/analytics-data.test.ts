import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadPeriodAnalytics,
  summarizeReportScores,
} from "@/lib/admin/analytics-data";

const heuristic = {
  overall: 40,
  scientific_provenance: { assessment_mode: "heuristic_fallback" },
};

describe("summarizeReportScores", () => {
  it("excludes heuristic-fallback reports from the mean but counts them", () => {
    const out = summarizeReportScores([
      { scores: { overall: 80 } },
      { scores: { overall: 61 } },
      { scores: heuristic },
    ]);
    expect(out).toEqual({ reportsCount: 3, fallbackCount: 1, avgOverall: 71 });
  });

  it("returns a null mean when only fallback or unscored reports exist", () => {
    expect(
      summarizeReportScores([{ scores: heuristic }, { scores: null }]),
    ).toEqual({ reportsCount: 2, fallbackCount: 1, avgOverall: null });
  });
});

type Call = { table: string; range?: [number, number]; ids?: string[] };

function fakeClient(opts: {
  totalSessions: number;
  sessionsError?: string;
  reportsError?: string;
}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table };
      calls.push(call);
      const builder = {
        select: () => builder,
        gte: () => builder,
        order: () => builder,
        range(from: number, to: number) {
          call.range = [from, to];
          if (opts.sessionsError) {
            return Promise.resolve({ data: null, error: { message: opts.sessionsError } });
          }
          const end = Math.min(to + 1, opts.totalSessions);
          const data = [];
          for (let i = from; i < end; i += 1) {
            data.push({ id: `s${i}`, status: "completed", language: "en", institution_id: null, institutions: null });
          }
          return Promise.resolve({ data, error: null });
        },
        in(_col: string, ids: string[]) {
          call.ids = ids;
          if (opts.reportsError) {
            return Promise.resolve({ data: null, error: { message: opts.reportsError } });
          }
          return Promise.resolve({
            data: ids.map(() => ({ scores: { overall: 50 } })),
            error: null,
          });
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("loadPeriodAnalytics", () => {
  it("pages past the 1000-row cap and batches report lookups", async () => {
    const { client, calls } = fakeClient({ totalSessions: 2300 });
    const out = await loadPeriodAnalytics(client, "2026-01-01T00:00:00Z");
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.sessions).toHaveLength(2300);
    expect(out.reports.reportsCount).toBe(2300);
    const sessionPages = calls.filter((c) => c.table === "sessions");
    expect(sessionPages.map((c) => c.range?.[0])).toEqual([0, 1000, 2000]);
    const reportBatches = calls.filter((c) => c.table === "session_reports");
    expect(reportBatches.every((c) => (c.ids?.length ?? 0) <= 200)).toBe(true);
  });

  it("surfaces a sessions query error instead of empty data", async () => {
    const { client } = fakeClient({ totalSessions: 5, sessionsError: "boom" });
    const out = await loadPeriodAnalytics(client, "2026-01-01T00:00:00Z");
    expect(out).toEqual({ ok: false, stage: "sessions", message: "boom" });
  });

  it("surfaces a reports query error", async () => {
    const { client } = fakeClient({ totalSessions: 5, reportsError: "nope" });
    const out = await loadPeriodAnalytics(client, "2026-01-01T00:00:00Z");
    expect(out).toEqual({ ok: false, stage: "reports", message: "nope" });
  });

  it("skips the reports query when the period has no sessions", async () => {
    const { client, calls } = fakeClient({ totalSessions: 0 });
    const out = await loadPeriodAnalytics(client, "2026-01-01T00:00:00Z");
    expect(out.ok && out.reports.reportsCount).toBe(0);
    expect(calls.some((c) => c.table === "session_reports")).toBe(false);
  });
});

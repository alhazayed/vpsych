import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/avatars/resolve", () => ({
  resolveAvatar: () => ({
    name: "Patient",
    disorder: "MDD",
    ideal_guidelines: null,
    rubric: [],
    locale: "en-US",
  }),
}));
vi.mock("@/lib/ai/assessment", () => ({ assessSession: vi.fn() }));

import {
  generateMissingReport,
  isHeuristicReportScores,
  regenerateHeuristicReport,
} from "@/lib/admin/report-regenerate";
import type { SupabaseClient } from "@supabase/supabase-js";

const HEURISTIC = {
  overall: 40,
  items: [],
  scientific_provenance: {
    ai_source: "persona_fallback",
    assessment_mode: "heuristic_fallback",
  },
};
const LLM = {
  overall: 72,
  items: [],
  scientific_provenance: { ai_source: "gpt", assessment_mode: "llm_examiner" },
};

type Row = Record<string, unknown> | null;

function fakeSupabase(opts: {
  report: Row;
  session?: Row;
  messages?: Row[];
  updated?: Row;
}) {
  const updates: Array<{ patch: unknown; filters: Array<[string, unknown]> }> = [];
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = [];
    let patch: unknown = null;
    const b = {
      select: () => b,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return b;
      },
      order: () =>
        Promise.resolve({ data: opts.messages ?? [], error: null }),
      update: (p: unknown) => {
        patch = p;
        return b;
      },
      maybeSingle: () => {
        if (table === "session_reports" && patch) {
          updates.push({ patch, filters: [...filters] });
          return Promise.resolve({ data: opts.updated ?? null, error: null });
        }
        if (table === "session_reports")
          return Promise.resolve({ data: opts.report, error: null });
        if (table === "sessions")
          return Promise.resolve({ data: opts.session ?? null, error: null });
        return Promise.resolve({ data: null, error: null });
      },
    };
    return b;
  };
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const rpc = (fn: string, args: Record<string, unknown>) => {
    rpcCalls.push({ fn, args });
    return Promise.resolve({ data: "new-report", error: null });
  };
  return {
    client: { from, rpc } as unknown as SupabaseClient,
    updates,
    rpcCalls,
  };
}

const SESSION = {
  id: "s1",
  started_at: "2026-10-03T10:00:00Z",
  ended_at: "2026-10-03T10:10:00Z",
  language: "ar",
  clinical_snapshot: null,
  avatars: { id: "a1" },
};
const REPORT = { id: "r1", scores: HEURISTIC, narrative: "heuristic text", language: "ar" };

function assessResult(aiSource: string) {
  return {
    language: "ar",
    scores: { overall: 81, items: [] },
    narrative: "examiner narrative",
    excerpts: ["x"],
    aiSource,
    model: aiSource === "persona_fallback" ? undefined : "gpt-5",
    errorKind: aiSource === "persona_fallback" ? "quota" : undefined,
  };
}

describe("isHeuristicReportScores", () => {
  it("detects heuristic provenance", () => {
    expect(isHeuristicReportScores(HEURISTIC)).toBe(true);
    expect(
      isHeuristicReportScores({
        educational_reliability: { assessment_mode: "heuristic_fallback" },
      }),
    ).toBe(true);
  });
  it("rejects examiner and malformed scores", () => {
    expect(isHeuristicReportScores(LLM)).toBe(false);
    expect(isHeuristicReportScores(null)).toBe(false);
    expect(isHeuristicReportScores({ overall: 50, items: [] })).toBe(false);
  });
});

describe("regenerateHeuristicReport", () => {
  it("404s when no report exists", async () => {
    const { client } = fakeSupabase({ report: null });
    const r = await regenerateHeuristicReport(client, "s1", { assess: vi.fn() });
    expect(r).toMatchObject({ ok: false, status: 404, code: "report_not_found" });
  });

  it("never overwrites an AI-examiner report", async () => {
    const assess = vi.fn();
    const { client, updates } = fakeSupabase({
      report: { ...REPORT, scores: LLM },
      session: SESSION,
    });
    const r = await regenerateHeuristicReport(client, "s1", { assess });
    expect(r).toMatchObject({ ok: false, status: 409, code: "not_heuristic" });
    expect(assess).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("writes nothing when the examiner still falls back", async () => {
    const assess = vi.fn().mockResolvedValue(assessResult("persona_fallback"));
    const { client, updates } = fakeSupabase({ report: REPORT, session: SESSION });
    const r = await regenerateHeuristicReport(client, "s1", {
      assess: assess as never,
    });
    expect(r).toMatchObject({ ok: false, status: 503, code: "ai_unavailable" });
    expect(updates).toHaveLength(0);
  });

  it("replaces the heuristic report with a CAS on the old narrative", async () => {
    const assess = vi.fn().mockResolvedValue(assessResult("gpt"));
    const { client, updates } = fakeSupabase({
      report: REPORT,
      session: SESSION,
      messages: [{ role: "user", content: "مرحبا", created_at: "t" }],
      updated: { id: "r1" },
    });
    const r = await regenerateHeuristicReport(client, "s1", {
      assess: assess as never,
    });
    expect(r).toEqual({
      ok: true,
      reportId: "r1",
      aiSource: "gpt",
      aiModel: "gpt-5",
      overall: 81,
    });
    expect(assess).toHaveBeenCalledWith(
      expect.objectContaining({ durationSec: 600, language: "ar" }),
    );
    expect(updates).toHaveLength(1);
    expect(updates[0].filters).toEqual([
      ["id", "r1"],
      ["narrative", "heuristic text"],
    ]);
    expect(updates[0].patch).toMatchObject({
      narrative: "examiner narrative",
      language: "ar",
    });
  });

  it("reports a concurrent update when the CAS matches nothing", async () => {
    const assess = vi.fn().mockResolvedValue(assessResult("gpt"));
    const { client } = fakeSupabase({ report: REPORT, session: SESSION, updated: null });
    const r = await regenerateHeuristicReport(client, "s1", {
      assess: assess as never,
    });
    expect(r).toMatchObject({ ok: false, status: 409, code: "concurrent_update" });
  });
});

describe("generateMissingReport", () => {
  const FINISHED = { ...SESSION, status: "expired" };
  const TURNS = [{ role: "user", content: "hello", created_at: "t" }];

  it("refuses when a report already exists", async () => {
    const assess = vi.fn();
    const { client } = fakeSupabase({ report: REPORT, session: FINISHED });
    const r = await generateMissingReport(client, "s1", {
      assess,
      reportWriteKey: () => "k".repeat(32),
    });
    expect(r).toMatchObject({ ok: false, status: 409, code: "report_exists" });
    expect(assess).not.toHaveBeenCalled();
  });

  it("refuses active sessions and sessions without therapist turns", async () => {
    const assess = vi.fn();
    const key = () => "k".repeat(32);
    const active = fakeSupabase({ report: null, session: { ...SESSION, status: "active" }, messages: TURNS });
    expect(await generateMissingReport(active.client, "s1", { assess, reportWriteKey: key }))
      .toMatchObject({ ok: false, code: "session_active" });
    const empty = fakeSupabase({ report: null, session: FINISHED, messages: [] });
    expect(await generateMissingReport(empty.client, "s1", { assess, reportWriteKey: key }))
      .toMatchObject({ ok: false, status: 422, code: "no_therapist_turns" });
    expect(assess).not.toHaveBeenCalled();
  });

  it("refuses admin test sessions", async () => {
    const assess = vi.fn();
    const { client } = fakeSupabase({
      report: null,
      session: { ...FINISHED, clinical_snapshot: { admin_test: true } },
      messages: TURNS,
    });
    const r = await generateMissingReport(client, "s1", {
      assess,
      reportWriteKey: () => "k".repeat(32),
    });
    expect(r).toMatchObject({ ok: false, status: 409, code: "admin_test" });
    expect(assess).not.toHaveBeenCalled();
  });

  it("fails closed when neither write key nor service role is configured", async () => {
    const assess = vi.fn();
    const { client } = fakeSupabase({ report: null, session: FINISHED, messages: TURNS });
    const r = await generateMissingReport(client, "s1", {
      assess,
      reportWriteKey: () => null,
      serviceClient: () => null,
    });
    expect(r).toMatchObject({ ok: false, status: 503, code: "misconfigured" });
    expect(assess).not.toHaveBeenCalled();
  });

  it("creates the report through the signed RPC", async () => {
    const assess = vi.fn().mockResolvedValue(assessResult("gpt"));
    const { client, rpcCalls } = fakeSupabase({
      report: null,
      session: FINISHED,
      messages: TURNS,
    });
    const r = await generateMissingReport(client, "s1", {
      assess: assess as never,
      reportWriteKey: () => "k".repeat(32),
    });
    expect(r).toMatchObject({ ok: true, reportId: "new-report", aiSource: "gpt" });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("create_session_report");
    expect(rpcCalls[0].args).toMatchObject({
      p_session_id: "s1",
      p_narrative: "examiner narrative",
    });
    expect(typeof rpcCalls[0].args.p_sig).toBe("string");
  });

  it("persists a fallback result so it stays flagged and regenerable", async () => {
    const assess = vi.fn().mockResolvedValue(assessResult("persona_fallback"));
    const { client, rpcCalls } = fakeSupabase({
      report: null,
      session: FINISHED,
      messages: TURNS,
    });
    const r = await generateMissingReport(client, "s1", {
      assess: assess as never,
      reportWriteKey: () => "k".repeat(32),
    });
    expect(r).toMatchObject({ ok: true, aiSource: "persona_fallback" });
    expect(rpcCalls).toHaveLength(1);
  });
});

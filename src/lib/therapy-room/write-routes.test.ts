/**
 * Route-level input checks for the Therapy Room write routes: immersion
 * metrics, private notes and clinic appointments (OWASP review finding #10).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  IMMERSION_METRICS_MAX_BYTES,
  isImmersionMetrics,
  parseVoiceUrl,
} from "@/lib/therapy-room";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const SESSION = "22222222-2222-4222-8222-222222222222";
const OTHER_SESSION = "44444444-4444-4444-8444-444444444444";
const APPOINTMENT = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({ supabase: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
}));

/** Tiny in-memory stand-in for the PostgREST query builder. */
function fakeSupabase(tables: Record<string, Row[]>) {
  const writes: { table: string; op: string; row: Row }[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    let op: { kind: "update" | "insert"; row: Row } | null = null;
    const rows = () =>
      (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
    const run = () => {
      if (op?.kind === "insert") {
        const row = { id: "new-row", ...op.row };
        writes.push({ table, op: "insert", row: op.row });
        return row;
      }
      const hit = rows()[0] ?? null;
      if (op?.kind === "update" && hit) {
        Object.assign(hit, op.row);
        writes.push({ table, op: "update", row: op.row });
      }
      return hit;
    };
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        return q;
      },
      order: () => q,
      update: (row: Row) => {
        op = { kind: "update", row };
        return q;
      },
      insert: (row: Row) => {
        op = { kind: "insert", row };
        return q;
      },
      single: async () => {
        const data = run();
        return { data, error: data ? null : { message: "no rows" } };
      },
      maybeSingle: async () => ({ data: run(), error: null }),
      then: (resolve: (v: { data: unknown; error: null }) => void) =>
        resolve({ data: run(), error: null }),
    };
    return q;
  };
  return {
    writes,
    client: {
      auth: { getUser: async () => ({ data: { user: { id: OWNER } } }) },
      from,
    },
  };
}

function seed(status = "active") {
  return fakeSupabase({
    sessions: [
      { id: SESSION, therapist_id: OWNER, status },
      { id: OTHER_SESSION, therapist_id: OTHER, status: "active" },
    ],
    clinic_appointments: [
      { id: APPOINTMENT, therapist_id: OWNER, status: "scheduled", session_id: null },
    ],
  });
}

const json = (url: string, method: string, body: unknown) =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv("FEATURE_THERAPY_ROOM", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("input helpers", () => {
  it("accepts only https voice links", () => {
    expect(parseVoiceUrl(undefined)).toEqual({ ok: true, value: null });
    expect(parseVoiceUrl("")).toEqual({ ok: true, value: null });
    expect(parseVoiceUrl("https://cdn.example.com/a.webm")).toEqual({
      ok: true,
      value: "https://cdn.example.com/a.webm",
    });
    expect(parseVoiceUrl("javascript:alert(1)").ok).toBe(false);
    expect(parseVoiceUrl("http://cdn.example.com/a.webm").ok).toBe(false);
    expect(parseVoiceUrl("data:audio/webm;base64,AAAA").ok).toBe(false);
    expect(parseVoiceUrl(42).ok).toBe(false);
    expect(parseVoiceUrl(`https://x.example/${"a".repeat(2048)}`).ok).toBe(false);
  });

  it("accepts immersion metrics only as a bounded plain object", () => {
    expect(isImmersionMetrics({ overall: 72, eventCounts: { turn: 4 } })).toBe(true);
    expect(isImmersionMetrics([1, 2])).toBe(false);
    expect(isImmersionMetrics("x")).toBe(false);
    expect(
      isImmersionMetrics({ blob: "x".repeat(IMMERSION_METRICS_MAX_BYTES) }),
    ).toBe(false);
  });
});

describe("PATCH /api/sessions/:id/therapy-room", () => {
  const ctx = { params: Promise.resolve({ id: SESSION }) };
  const url = `http://localhost/api/sessions/${SESSION}/therapy-room`;

  it("saves notes and metrics while the session is active", async () => {
    const db = seed();
    state.supabase = db.client;
    const { PATCH } = await import("@/app/api/sessions/[id]/therapy-room/route");
    const res = await PATCH(
      json(url, "PATCH", { privateNotes: "n", immersionMetrics: { overall: 80 } }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(db.writes).toEqual([
      {
        table: "sessions",
        op: "update",
        row: { private_notes: "n", immersion_metrics: { overall: 80 } },
      },
    ]);
  });

  it("refuses writes once the session has ended", async () => {
    const db = seed("completed");
    state.supabase = db.client;
    const { PATCH } = await import("@/app/api/sessions/[id]/therapy-room/route");
    const res = await PATCH(
      json(url, "PATCH", { immersionMetrics: { overall: 100 } }),
      ctx,
    );
    expect(res.status).toBe(409);
    expect(db.writes).toEqual([]);
  });

  it("refuses an oversized or non-object metrics payload", async () => {
    const db = seed();
    state.supabase = db.client;
    const { PATCH } = await import("@/app/api/sessions/[id]/therapy-room/route");
    for (const immersionMetrics of [
      { blob: "x".repeat(IMMERSION_METRICS_MAX_BYTES) },
      [1, 2, 3],
      "overall",
    ]) {
      const res = await PATCH(json(url, "PATCH", { immersionMetrics }), ctx);
      expect(res.status).toBe(400);
    }
    expect(db.writes).toEqual([]);
  });
});

describe("POST /api/sessions/:id/notes", () => {
  const ctx = { params: Promise.resolve({ id: SESSION }) };
  const url = `http://localhost/api/sessions/${SESSION}/notes`;

  it("saves a note in a known format", async () => {
    const db = seed();
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/[id]/notes/route");
    const res = await POST(json(url, "POST", { format: "soap", body: "S: ..." }), ctx);
    expect(res.status).toBe(200);
    expect(db.writes).toMatchObject([
      {
        table: "session_private_notes",
        op: "insert",
        row: { format: "soap", body: "S: ...", voice_url: null },
      },
    ]);
  });

  it("refuses an unknown format, a non-https voice link and a broken body", async () => {
    const db = seed();
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/[id]/notes/route");
    expect((await POST(json(url, "POST", { format: "html", body: "x" }), ctx)).status).toBe(400);
    expect(
      (await POST(json(url, "POST", { body: "x", voiceUrl: "javascript:alert(1)" }), ctx)).status,
    ).toBe(400);
    expect((await POST(json(url, "POST", "{not json"), ctx)).status).toBe(400);
    expect(db.writes).toEqual([]);
  });
});

describe("PATCH /api/clinic/appointments/:id", () => {
  const ctx = { params: Promise.resolve({ id: APPOINTMENT }) };
  const url = `http://localhost/api/clinic/appointments/${APPOINTMENT}`;

  it("links the appointment to the therapist's own session", async () => {
    const db = seed();
    state.supabase = db.client;
    const { PATCH } = await import("@/app/api/clinic/appointments/[id]/route");
    const res = await PATCH(
      json(url, "PATCH", { status: "in_session", sessionId: SESSION }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(db.writes[0]?.row).toMatchObject({ status: "in_session", session_id: SESSION });
  });

  it("refuses another therapist's session, an unknown status and a non-uuid id", async () => {
    const db = seed();
    state.supabase = db.client;
    const { PATCH } = await import("@/app/api/clinic/appointments/[id]/route");
    expect(
      (await PATCH(json(url, "PATCH", { sessionId: OTHER_SESSION }), ctx)).status,
    ).toBe(400);
    expect((await PATCH(json(url, "PATCH", { status: "archived" }), ctx)).status).toBe(400);
    expect((await PATCH(json(url, "PATCH", { sessionId: "1 or 1=1" }), ctx)).status).toBe(400);
    expect(db.writes).toEqual([]);
  });
});

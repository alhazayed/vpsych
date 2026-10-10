/**
 * Route-level tests for POST /api/sessions/:id/end, covering everything before
 * the assessment runs: auth, rate limit, ownership, the active → completed /
 * expired transition, the concurrent-writer path, and report idempotency.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "33333333-3333-4333-8333-333333333333";
const SESSION = "22222222-2222-4222-8222-222222222222";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  userId: null as string | null,
  limited: false,
  session: null as Row | null,
  casResult: null as Row | null,
  freshAfterCasMiss: null as Row | null,
  hasReport: false,
  updates: [] as Row[],
  assessCalls: 0,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () =>
    state.limited ? { ok: false, retryAfterSec: 42 } : { ok: true, retryAfterSec: 0 },
}));

vi.mock("@/lib/ai/assessment", () => ({
  assessSession: async () => {
    state.assessCalls += 1;
    throw new Error("assessment is out of scope for these tests");
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.userId ? { id: state.userId } : null },
      }),
    },
    rpc: async (name: string) =>
      name === "session_has_report"
        ? { data: state.hasReport, error: null }
        : { data: null, error: null },
    from: (table: string) => {
      let isUpdate = false;
      const q = {
        select: () => q,
        eq: () => q,
        update: (patch: Row) => {
          isUpdate = true;
          state.updates.push(patch);
          return q;
        },
        single: async () =>
          table === "sessions" && state.session
            ? { data: state.session, error: null }
            : { data: null, error: { message: "not found" } },
        maybeSingle: async () => {
          if (table !== "sessions") return { data: null, error: null };
          return {
            data: isUpdate ? state.casResult : state.freshAfterCasMiss,
            error: null,
          };
        },
      };
      return q;
    },
  }),
}));

const { POST } = await import("@/app/api/sessions/[id]/end/route");

const ctx = { params: Promise.resolve({ id: SESSION }) };
const req = () =>
  new Request(`http://localhost/api/sessions/${SESSION}/end`, { method: "POST" });

function session(overrides: Row = {}): Row {
  return {
    id: SESSION,
    therapist_id: OWNER,
    avatar_id: "avatar-1",
    status: "completed",
    started_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    max_duration_sec: 2400,
    language: "en",
    clinical_snapshot: null,
    skill_test_assignment_id: null,
    therapy_course_id: null,
    avatars: { id: "avatar-1" },
    ...overrides,
  };
}

beforeEach(() => {
  state.userId = OWNER;
  state.limited = false;
  state.session = session();
  state.casResult = null;
  state.freshAfterCasMiss = null;
  state.hasReport = false;
  state.updates = [];
  state.assessCalls = 0;
});

describe("POST /api/sessions/:id/end", () => {
  it("returns 401 when signed out", async () => {
    state.userId = null;
    const res = await POST(req(), ctx);
    expect(res.status).toBe(401);
  });

  it("returns 429 with Retry-After when rate-limited", async () => {
    state.limited = true;
    const res = await POST(req(), ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });

  it("returns 404 for an unknown session", async () => {
    state.session = null;
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 to someone who does not own the session", async () => {
    state.userId = OTHER;
    const res = await POST(req(), ctx);
    expect(res.status).toBe(403);
    expect(state.updates).toEqual([]);
  });

  it("does not assess again when a report already exists", async () => {
    state.hasReport = true;
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, alreadyExists: true });
    expect(state.assessCalls).toBe(0);
  });

  it("marks an active session completed before checking for a report", async () => {
    state.session = session({ status: "active", ended_at: null });
    state.casResult = { id: SESSION, status: "completed", ended_at: new Date().toISOString() };
    state.hasReport = true;
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ status: "completed" });
  });

  it("marks an over-time session expired, with ended_at at the time limit", async () => {
    const startedAt = new Date(Date.now() - 50 * 60 * 1000);
    state.session = session({
      status: "active",
      ended_at: null,
      started_at: startedAt.toISOString(),
    });
    state.casResult = { id: SESSION, status: "expired", ended_at: "x" };
    state.hasReport = true;
    await POST(req(), ctx);
    expect(state.updates[0]).toMatchObject({
      status: "expired",
      ended_at: new Date(startedAt.getTime() + 2400 * 1000).toISOString(),
    });
  });

  it("accepts a session another writer already finished", async () => {
    state.session = session({ status: "active", ended_at: null });
    state.casResult = null;
    state.freshAfterCasMiss = { status: "expired", ended_at: new Date().toISOString() };
    state.hasReport = true;
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
  });

  it("returns 409 when the session changed to an unexpected status", async () => {
    state.session = session({ status: "active", ended_at: null });
    state.casResult = null;
    state.freshAfterCasMiss = { status: "active", ended_at: null };
    const res = await POST(req(), ctx);
    expect(res.status).toBe(409);
    expect(state.assessCalls).toBe(0);
  });
});

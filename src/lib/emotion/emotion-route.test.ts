/**
 * Route-level tests for /api/sessions/:id/emotion: the owner never receives
 * the diagnosis, and the owner cannot persist emotion changes from here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const SLUG = "major-depressive-disorder";

const state = vi.hoisted(() => ({
  supabase: null as unknown,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
}));

function fakeSupabase(opts: { role?: string; userId?: string } = {}) {
  const session = {
    id: SESSION,
    therapist_id: OWNER,
    status: "active",
    case_instance_id: null,
    clinical_snapshot: { primary_diagnosis: { slug: SLUG } },
    skill_test_assignment_id: null,
    sealed_case: null,
    started_at: new Date().toISOString(),
    max_duration_sec: 2400,
  };
  const writes: string[] = [];
  const query = (row: unknown) => {
    const q = {
      select: () => q,
      eq: () => q,
      single: async () => ({ data: row, error: null }),
      maybeSingle: async () => ({ data: row, error: null }),
      upsert: async () => {
        writes.push("upsert");
        return { error: null };
      },
      update: () => {
        writes.push("update");
        return q;
      },
      insert: async () => {
        writes.push("insert");
        return { error: null };
      },
    };
    return q;
  };
  return {
    writes,
    client: {
      auth: {
        getUser: async () => ({ data: { user: { id: opts.userId ?? OWNER } } }),
      },
      from: (table: string) =>
        table === "sessions"
          ? query(session)
          : table === "profiles"
            ? query({ role: opts.role ?? "therapist" })
            : query(null),
    },
  };
}

const ctx = { params: Promise.resolve({ id: SESSION }) };
const req = (body?: unknown) =>
  new Request(`http://localhost/api/sessions/${SESSION}/emotion`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/sessions/:id/emotion", () => {
  it("never returns the diagnosis to the session owner", async () => {
    state.supabase = fakeSupabase().client;
    const { GET } = await import("@/app/api/sessions/[id]/emotion/route");
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(SLUG);
    expect(text).not.toContain("disorder_slug");
    expect(JSON.parse(text).state.mode).toBeTruthy();
  });

  it("keeps the full state for an admin", async () => {
    state.supabase = fakeSupabase({
      role: "admin",
      userId: "33333333-3333-4333-8333-333333333333",
    }).client;
    const { GET } = await import("@/app/api/sessions/[id]/emotion/route");
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { state: { disorder_slug: string } };
    expect(json.state.disorder_slug).toBe(SLUG);
  });
});

describe("POST /api/sessions/:id/emotion", () => {
  it.each([
    [{ reset: true }],
    [{ intervention: "hostility" }],
    [{ message: "Calm down." }],
  ])("refuses a persisting request %j", async (body) => {
    const db = fakeSupabase();
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/[id]/emotion/route");
    const res = await POST(req(body), ctx);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(
      "EMOTION_READ_ONLY",
    );
    expect(db.writes).toEqual([]);
  });

  it("simulates without persisting or leaking the diagnosis", async () => {
    const db = fakeSupabase();
    state.supabase = db.client;
    const { POST } = await import("@/app/api/sessions/[id]/emotion/route");
    const res = await POST(
      req({ simulate: true, intervention: "validation" }),
      ctx,
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(SLUG);
    expect(JSON.parse(text)).toMatchObject({ simulate: true, persisted: false });
    expect(db.writes).toEqual([]);
  });

  it("caps the simulated message length", async () => {
    state.supabase = fakeSupabase().client;
    const { POST } = await import("@/app/api/sessions/[id]/emotion/route");
    const res = await POST(
      req({ simulate: true, message: "x".repeat(4001) }),
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

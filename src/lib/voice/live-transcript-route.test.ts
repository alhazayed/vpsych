import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.VOICE_LIVE_TRANSCRIPT;
});

type SessionRow = { id: string; status: string; started_at: string; max_duration_sec: number };
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const activeSession = (): SessionRow => ({
  id: SESSION_ID,
  status: "active",
  started_at: new Date(Date.now() - 60_000).toISOString(),
  max_duration_sec: 2400,
});

function mocks(
  opts: { authed?: boolean; limited?: boolean; key?: boolean; session?: SessionRow | null } = {},
) {
  const filters: Array<[string, unknown]> = [];
  const row = opts.session === undefined ? activeSession() : opts.session;
  const query = {
    select: () => query,
    eq: (col: string, value: unknown) => {
      filters.push([col, value]);
      return query;
    },
    maybeSingle: async () => ({ data: row, error: null }),
  };
  const supabase = { from: () => query };
  const create = vi.fn(async (params: { language?: string }) => ({
    value: "ek_test",
    expiresAt: 1_900_000_000,
    model: "gpt-4o-transcribe",
    language: params.language,
  }));
  const keys: Array<[string, number]> = [];
  vi.doMock("@/lib/api-auth", () => ({
    requireApiUser: async () =>
      opts.authed === false
        ? { ok: false, response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) }
        : { ok: true, user: { id: "u1" }, supabase },
  }));
  vi.doMock("@/lib/rate-limit", () => ({
    rateLimit: (key: string, limit: number) => {
      keys.push([key, limit]);
      return opts.limited ? { ok: false, retryAfterSec: 30 } : { ok: true };
    },
  }));
  vi.doMock("@/lib/ai/openai", () => ({
    hasOpenAIApiKey: () => opts.key !== false,
    openAIService: { createLiveTranscriptionSecret: create },
    OpenAIServiceError: class OpenAIServiceError extends Error {},
  }));
  return { create, keys, filters };
}

const call = async (body: unknown = { locale: "ar-JO", sessionId: SESSION_ID }) => {
  const { POST } = await import("@/app/api/voice/live-transcript/route");
  return POST(
    new Request("http://localhost/api/voice/live-transcript", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
};

describe("POST /api/voice/live-transcript", () => {
  it("mints a transcription secret in the session language, rate-limited per user", async () => {
    const { create, keys } = mocks();
    const res = await call();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      clientSecret: "ek_test",
      expiresAt: 1_900_000_000,
      model: "gpt-4o-transcribe",
      url: "wss://api.openai.com/v1/realtime?intent=transcription",
    });
    expect(create).toHaveBeenCalledWith({ language: "ar" });
    expect(keys).toEqual([["stt-live:u1", 30]]);
  });

  it("mints only for the caller's own active session", async () => {
    const { create, filters } = mocks();
    expect((await call()).status).toBe(200);
    expect(filters).toEqual([
      ["id", SESSION_ID],
      ["therapist_id", "u1"],
    ]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("refuses without a session id", async () => {
    const { create } = mocks();
    expect((await call({ locale: "en" })).status).toBe(400);
    expect((await call({ locale: "en", sessionId: "not-a-uuid" })).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses for someone else's, ended or timed-out session", async () => {
    for (const session of [
      null,
      { ...activeSession(), status: "completed" },
      { ...activeSession(), started_at: new Date(Date.now() - 3_000_000).toISOString() },
    ]) {
      vi.resetModules();
      const { create } = mocks({ session });
      expect((await call()).status).toBe(409);
      expect(create).not.toHaveBeenCalled();
    }
  });

  it("requires a signed-in, approved user", async () => {
    const { create } = mocks({ authed: false });
    expect((await call()).status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when over budget", async () => {
    const { create } = mocks({ limited: true });
    const res = await call();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(create).not.toHaveBeenCalled();
  });

  it("is off with VOICE_LIVE_TRANSCRIPT=false (client falls back to upload)", async () => {
    process.env.VOICE_LIVE_TRANSCRIPT = "false";
    const { create } = mocks();
    expect((await call()).status).toBe(404);
    expect(create).not.toHaveBeenCalled();
  });

  it("501 without an OpenAI key", async () => {
    mocks({ key: false });
    expect((await call()).status).toBe(501);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.VOICE_LIVE_TRANSCRIPT;
});

function mocks(opts: { authed?: boolean; limited?: boolean; key?: boolean } = {}) {
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
        : { ok: true, user: { id: "u1" } },
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
  return { create, keys };
}

const call = async (body: unknown = { locale: "ar-JO" }) => {
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

import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIServiceError } from "@/lib/ai/openai/errors";
import { withOpenAIRetry } from "@/lib/ai/openai/retry";

describe("withOpenAIRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns on first success", async () => {
    const result = await withOpenAIRetry(async () => "ok", { attempts: 3 });
    expect(result).toBe("ok");
  });

  it("retries retryable errors then succeeds", async () => {
    let calls = 0;
    const result = await withOpenAIRetry(
      async () => {
        calls += 1;
        if (calls < 2) {
          throw new OpenAIServiceError("temp", {
            code: "OPENAI_CONNECTION",
            retryable: true,
          });
        }
        return "done";
      },
      { attempts: 3, baseDelayMs: 1 },
    );
    expect(result).toBe("done");
    expect(calls).toBe(2);
  });

  it("does not retry non-retryable errors", async () => {
    let calls = 0;
    await expect(
      withOpenAIRetry(
        async () => {
          calls += 1;
          throw new OpenAIServiceError("auth", {
            code: "OPENAI_AUTH",
            retryable: false,
          });
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toMatchObject({ code: "OPENAI_AUTH" });
    expect(calls).toBe(1);
  });
});

describe("OpenAIServiceError mapping", () => {
  it("preserves OpenAIServiceError instances", async () => {
    const err = new OpenAIServiceError("x", {
      code: "OPENAI_API",
      status: 500,
      retryable: true,
    });
    await expect(
      withOpenAIRetry(async () => {
        throw err;
      }, { attempts: 1 }),
    ).rejects.toBe(err);
  });
});

describe("openai service exports", () => {
  it("exposes chat defaults", async () => {
    const mod = await import("@/lib/ai/openai");
    expect(mod.DEFAULT_OPENAI_CHAT_MODEL).toBe("gpt-5");
    expect(mod.DEFAULT_OPENAI_STT_MODEL).toBe("gpt-4o-transcribe");
    expect(typeof mod.openAIService.chat).toBe("function");
    expect(typeof mod.openAIService.speechToText).toBe("function");
    expect(typeof mod.openAIService.healthCheck).toBe("function");
  });

  it("healthCheck reports unconfigured without key", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { openAIService, resetOpenAIClient } = await import("@/lib/ai/openai");
    resetOpenAIClient();
    const status = await openAIService.healthCheck();
    expect(status.ok).toBe(false);
    expect(status.configured).toBe(false);
    expect(status.code).toBe("OPENAI_CONFIG");
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });
});

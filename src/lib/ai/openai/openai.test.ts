import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIServiceError } from "@/lib/ai/openai/errors";
import { withOpenAIRetry } from "@/lib/ai/openai/retry";
import { isReasoningModel } from "@/lib/ai/openai/service";

vi.mock("@/lib/ai/openai/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ai/openai/client")
  >("@/lib/ai/openai/client");
  return {
    ...actual,
    getOpenAIClient: () =>
      (globalThis as Record<string, unknown>).__openaiMock,
  };
});

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
            kind: "connection",
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
            kind: "authentication",
            retryable: false,
          });
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toMatchObject({ code: "OPENAI_AUTH" });
    expect(calls).toBe(1);
  });

  it("does not retry HTTP 429 rate_limit errors", async () => {
    let calls = 0;
    await expect(
      withOpenAIRetry(
        async () => {
          calls += 1;
          throw new OpenAIServiceError("rate limited", {
            code: "OPENAI_RATE_LIMIT",
            kind: "rate_limit",
            status: 429,
            retryable: false,
          });
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toMatchObject({ code: "OPENAI_RATE_LIMIT", retryable: false });
    expect(calls).toBe(1);
  });
});

describe("OpenAIServiceError mapping", () => {
  it("preserves OpenAIServiceError instances", async () => {
    const err = new OpenAIServiceError("x", {
      code: "OPENAI_API",
      kind: "api",
      status: 500,
      retryable: true,
    });
    await expect(
      withOpenAIRetry(async () => {
        throw err;
      }, { attempts: 1 }),
    ).rejects.toBe(err);
  });

  it("distinguishes insufficient_quota from rate_limit", async () => {
    const { RateLimitError } = await import("openai");
    const { toOpenAIServiceError } = await import("@/lib/ai/openai/errors");
    const quota = new RateLimitError(
      429,
      { message: "You exceeded your current quota", code: "insufficient_quota" },
      "You exceeded your current quota",
      new Headers(),
    );
    const rate = new RateLimitError(
      429,
      { message: "Rate limit reached", code: "rate_limit_exceeded" },
      "Rate limit reached",
      new Headers(),
    );
    const quotaMapped = toOpenAIServiceError(quota);
    const rateMapped = toOpenAIServiceError(rate);
    expect(quotaMapped.kind).toBe("insufficient_quota");
    expect(quotaMapped.code).toBe("OPENAI_INSUFFICIENT_QUOTA");
    expect(quotaMapped.retryable).toBe(false);
    expect(rateMapped.kind).toBe("rate_limit");
    expect(rateMapped.code).toBe("OPENAI_RATE_LIMIT");
    expect(rateMapped.retryable).toBe(false);
  });

  it("maps auth, timeout, and invalid_request kinds", async () => {
    const {
      AuthenticationError,
      APIConnectionTimeoutError,
      BadRequestError,
    } = await import("openai");
    const { toOpenAIServiceError } = await import("@/lib/ai/openai/errors");

    const auth = toOpenAIServiceError(
      new AuthenticationError(
        401,
        { message: "invalid api key", code: "invalid_api_key" },
        "invalid api key",
        new Headers(),
      ),
    );
    expect(auth.kind).toBe("authentication");
    expect(auth.retryable).toBe(false);

    const timeout = toOpenAIServiceError(new APIConnectionTimeoutError());
    expect(timeout.kind).toBe("timeout");
    expect(timeout.code).toBe("OPENAI_TIMEOUT");

    const invalid = toOpenAIServiceError(
      new BadRequestError(
        400,
        { message: "bad request", code: "invalid_request_error" },
        "bad request",
        new Headers(),
      ),
    );
    expect(invalid.kind).toBe("invalid_request");
    expect(invalid.retryable).toBe(false);
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

  it("classifies reasoning vs standard models", () => {
    expect(isReasoningModel("gpt-5")).toBe(true);
    expect(isReasoningModel("gpt-5-mini")).toBe(true);
    expect(isReasoningModel("o1-preview")).toBe(true);
    expect(isReasoningModel("o3-mini")).toBe(true);
    expect(isReasoningModel("gpt-4o")).toBe(false);
    expect(isReasoningModel("gpt-4o-mini")).toBe(false);
  });

  it("omits temperature and sets reasoning_effort for reasoning models", async () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const create = vi.fn(async () => ({
      choices: [{ message: { content: "hi" } }],
      model: "gpt-5",
    }));
    (globalThis as Record<string, unknown>).__openaiMock = {
      chat: { completions: { create } },
    };
    const { openAIService } = await import("@/lib/ai/openai");
    await openAIService.chat({
      model: "gpt-5",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.85,
      maxCompletionTokens: 512,
    });
    const arg = (create.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(arg).not.toHaveProperty("temperature");
    expect(arg.reasoning_effort).toBe("minimal");
    expect(arg.max_completion_tokens).toBe(512);
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  });

  it("sends temperature (not reasoning_effort) for standard models", async () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    const create = vi.fn(async () => ({
      choices: [{ message: { content: "hi" } }],
      model: "gpt-4o",
    }));
    (globalThis as Record<string, unknown>).__openaiMock = {
      chat: { completions: { create } },
    };
    const { openAIService } = await import("@/lib/ai/openai");
    await openAIService.chat({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.85,
      maxCompletionTokens: 220,
    });
    const arg = (create.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(arg.temperature).toBe(0.85);
    expect(arg).not.toHaveProperty("reasoning_effort");
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
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

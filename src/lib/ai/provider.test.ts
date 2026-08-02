import { afterEach, describe, expect, it } from "vitest";
import { preferOpenAiSdk } from "@/lib/ai/provider";

describe("preferOpenAiSdk (shared chat + assessment)", () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.OPENAI_CHAT_PROVIDER;
  });

  it("prefers OpenAI when key is set even if gateway is also set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_GATEWAY_API_KEY = "gw-test";
    expect(preferOpenAiSdk()).toBe(true);
  });

  it("honors OPENAI_CHAT_PROVIDER=gateway", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.AI_GATEWAY_API_KEY = "gw-test";
    process.env.OPENAI_CHAT_PROVIDER = "gateway";
    expect(preferOpenAiSdk()).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildMessageSignaturePayload,
  signSessionMessage,
} from "./message-sign";

describe("message-sign (CQG-011)", () => {
  it("builds the canonical sessionId\\ncontent\\nrole payload", () => {
    expect(
      buildMessageSignaturePayload({
        sessionId: "sess-1",
        content: "hello",
        role: "assistant",
      }),
    ).toBe("sess-1\nhello\nassistant");
  });

  it("signs stably with a provided key", () => {
    const a = signSessionMessage({
      sessionId: "s",
      content: "c",
      role: "system",
      key: "test-key",
    });
    const b = signSessionMessage({
      sessionId: "s",
      content: "c",
      role: "system",
      key: "test-key",
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("throws when no key is available", () => {
    const prev = process.env.REPORT_WRITE_KEY;
    delete process.env.REPORT_WRITE_KEY;
    expect(() =>
      signSessionMessage({
        sessionId: "s",
        content: "c",
        role: "assistant",
        key: null,
      }),
    ).toThrow(/REPORT_WRITE_KEY/);
    if (prev !== undefined) process.env.REPORT_WRITE_KEY = prev;
  });
});

import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMessageSignaturePayload,
  buildReportSignaturePayload,
  buildSignedMessageRpcArgs,
  getReportWriteKey,
  signSessionMessage,
  signSessionReport,
} from "./report-sign";

const params = {
  sessionId: "11111111-2222-3333-4444-555555555555",
  narrative: "A short narrative.",
  scoresJson: '{"overall":50,"items":[]}',
  excerptsJson: "[]",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildReportSignaturePayload", () => {
  it("joins fields with newlines in the exact order the DB expects", () => {
    // This format MUST match public.create_session_report's HMAC payload:
    // session_id \n narrative \n scores_json \n excerpts_json
    expect(buildReportSignaturePayload(params)).toBe(
      `${params.sessionId}\n${params.narrative}\n${params.scoresJson}\n${params.excerptsJson}`,
    );
  });
});

describe("signSessionReport", () => {
  it("produces the HMAC-SHA256 hex digest the DB will recompute", () => {
    const key = "0123456789abcdef0123456789abcdef";
    const expected = createHmac("sha256", key)
      .update(buildReportSignaturePayload(params))
      .digest("hex");
    expect(signSessionReport({ ...params, key })).toBe(expected);
  });

  it("is deterministic for the same input and key", () => {
    const key = "a-shared-secret-value";
    expect(signSessionReport({ ...params, key })).toBe(
      signSessionReport({ ...params, key }),
    );
  });

  it("falls back to REPORT_WRITE_KEY from the environment", () => {
    vi.stubEnv("REPORT_WRITE_KEY", "env-key-value");
    const expected = createHmac("sha256", "env-key-value")
      .update(buildReportSignaturePayload(params))
      .digest("hex");
    expect(signSessionReport(params)).toBe(expected);
  });

  it("throws when no key is available", () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    expect(() => signSessionReport(params)).toThrow(/REPORT_WRITE_KEY/);
  });
});

describe("getReportWriteKey", () => {
  it("returns null when unset or blank", () => {
    vi.stubEnv("REPORT_WRITE_KEY", "   ");
    expect(getReportWriteKey()).toBeNull();
  });

  it("trims and returns a configured key", () => {
    vi.stubEnv("REPORT_WRITE_KEY", "  secret  ");
    expect(getReportWriteKey()).toBe("secret");
  });
});

describe("Phase 8.2 message HMAC", () => {
  const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const key = "message-integrity-test-key";

  it("builds the exact CQG-011 payload (sessionId\\ncontent\\nrole)", () => {
    expect(
      buildMessageSignaturePayload({
        sessionId,
        content: "Hello patient",
        role: "assistant",
      }),
    ).toBe(`${sessionId}\nHello patient\nassistant`);
    expect(
      buildMessageSignaturePayload({
        sessionId,
        content: "Session started.",
        role: "system",
      }),
    ).toBe(`${sessionId}\nSession started.\nsystem`);
  });

  it("signs assistant messages with HMAC-SHA256 hex", () => {
    const content = "I feel better after that validation.";
    const expected = createHmac("sha256", key)
      .update(`${sessionId}\n${content}\nassistant`)
      .digest("hex");
    expect(
      signSessionMessage({ sessionId, content, role: "assistant", key }),
    ).toBe(expected);
  });

  it("signs system messages with HMAC-SHA256 hex", () => {
    const content = "Session started. Speak with the patient avatar.";
    const expected = createHmac("sha256", key)
      .update(`${sessionId}\n${content}\nsystem`)
      .digest("hex");
    expect(
      signSessionMessage({ sessionId, content, role: "system", key }),
    ).toBe(expected);
  });

  it("rejects signing when key is missing", () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    expect(() =>
      signSessionMessage({
        sessionId,
        content: "x",
        role: "assistant",
      }),
    ).toThrow(/REPORT_WRITE_KEY/);
  });

  it("omits p_sig when using service role", () => {
    const out = buildSignedMessageRpcArgs({
      sessionId,
      content: "trusted",
      role: "assistant",
      usingServiceRole: true,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.args.p_sig).toBeUndefined();
    expect(out.args.p_content).toBe("trusted");
  });

  it("attaches p_sig when not using service role", () => {
    const content = "forged-looking text";
    const out = buildSignedMessageRpcArgs({
      sessionId,
      content,
      role: "assistant",
      usingServiceRole: false,
      key,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.args.p_sig).toBe(
      signSessionMessage({ sessionId, content, role: "assistant", key }),
    );
  });

  it("fails closed without service role or REPORT_WRITE_KEY", () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    const out = buildSignedMessageRpcArgs({
      sessionId,
      content: "x",
      role: "system",
      usingServiceRole: false,
    });
    expect(out.ok).toBe(false);
  });

  it("invalidates signature when content is modified", () => {
    const original = signSessionMessage({
      sessionId,
      content: "original assistant reply",
      role: "assistant",
      key,
    });
    const tampered = signSessionMessage({
      sessionId,
      content: "TAMPERED assistant reply",
      role: "assistant",
      key,
    });
    expect(original).not.toBe(tampered);
  });

  it("invalidates signature when session id is modified", () => {
    const a = signSessionMessage({
      sessionId,
      content: "same",
      role: "assistant",
      key,
    });
    const b = signSessionMessage({
      sessionId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      content: "same",
      role: "assistant",
      key,
    });
    expect(a).not.toBe(b);
  });

  it("assistant and system roles produce different signatures for same content", () => {
    const content = "identical body text";
    expect(
      signSessionMessage({ sessionId, content, role: "assistant", key }),
    ).not.toBe(
      signSessionMessage({ sessionId, content, role: "system", key }),
    );
  });
});

import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildReportSignaturePayload,
  getReportWriteKey,
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

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { authorizeCronRequest } from "./cron-auth";

describe("authorizeCronRequest", () => {
  const prev = process.env.CRON_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("fails closed when CRON_SECRET is unset", () => {
    const req = new Request("http://localhost/api/cron/expire-sessions");
    const r = authorizeCronRequest(req);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(503);
      expect(r.error).not.toMatch(/secret/i);
    }
  });

  it("rejects missing Authorization", () => {
    process.env.CRON_SECRET = "test-cron-secret-value";
    const req = new Request("http://localhost/api/cron/expire-sessions");
    const r = authorizeCronRequest(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejects wrong bearer without hinting", () => {
    process.env.CRON_SECRET = "test-cron-secret-value";
    const req = new Request("http://localhost/api/cron/expire-sessions", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const r = authorizeCronRequest(req);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
      expect(r.error).toBe("Unauthorized");
    }
  });

  it("accepts exact Bearer secret", () => {
    process.env.CRON_SECRET = "test-cron-secret-value";
    const req = new Request("http://localhost/api/cron/expire-sessions", {
      headers: { Authorization: "Bearer test-cron-secret-value" },
    });
    expect(authorizeCronRequest(req)).toEqual({ ok: true });
  });
});

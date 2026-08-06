import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
const createClientMock = vi.fn();
const createServiceClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => createClientMock(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => createServiceClientMock(),
}));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "user-agent": "vitest",
    }),
}));

describe("logSecurityEvent", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createClientMock.mockReset();
    createServiceClientMock.mockReset();
    // Prefer user client in unit tests (service role unset).
    createServiceClientMock.mockReturnValue(null);
    createClientMock.mockResolvedValue({ rpc: rpcMock });
    vi.resetModules();
  });

  it("calls the definer RPC with trimmed request metadata", async () => {
    rpcMock.mockResolvedValue({ data: "evt-1", error: null });
    const { logSecurityEvent } = await import("./security-audit");

    const id = await logSecurityEvent({
      action: "admin.report.view",
      outcome: "success",
      resourceType: "session",
      resourceId: "sess-1",
      metadata: { path: "/admin/reports/sess-1" },
    });

    expect(id).toBe("evt-1");
    expect(rpcMock).toHaveBeenCalledWith("log_security_event", {
      p_action: "admin.report.view",
      p_outcome: "success",
      p_resource_type: "session",
      p_resource_id: "sess-1",
      p_ip: "203.0.113.10",
      p_user_agent: "vitest",
      p_metadata: { path: "/admin/reports/sess-1" },
    });
  });

  it("swallows RPC errors and returns null", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { logSecurityEvent } = await import("./security-audit");

    await expect(
      logSecurityEvent({ action: "admin.access", outcome: "denied" }),
    ).resolves.toBeNull();
  });

  it("prefers the service-role client when configured (CQG-002)", async () => {
    const serviceRpc = vi
      .fn()
      .mockResolvedValue({ data: "evt-svc", error: null });
    createServiceClientMock.mockReturnValue({ rpc: serviceRpc });
    const { logSecurityEvent } = await import("./security-audit");

    const id = await logSecurityEvent({
      action: "admin.access",
      outcome: "denied",
    });

    expect(id).toBe("evt-svc");
    expect(serviceRpc).toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });
});

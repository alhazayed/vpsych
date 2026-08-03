import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ mocked: "service" })),
}));

describe("messageRpcClient", () => {
  const userClient = { mocked: "user" } as never;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });
  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("falls back to the authenticated client when service role is unset", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const { messageRpcClient, createServiceClient } = await import(
      "@/lib/supabase/admin"
    );
    expect(createServiceClient()).toBeNull();
    expect(messageRpcClient(userClient)).toBe(userClient);
  });

  it("prefers the service-role client when configured", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
    const { messageRpcClient, createServiceClient } = await import(
      "@/lib/supabase/admin"
    );
    const privileged = createServiceClient();
    expect(privileged).not.toBeNull();
    expect(messageRpcClient(userClient)).toBe(privileged);
  });
});

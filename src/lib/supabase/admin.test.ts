import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServiceClient,
  messageRpcClient,
  resetServiceClient,
} from "./admin";

describe("supabase admin helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetServiceClient();
  });

  it("returns null service client when key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(createServiceClient()).toBeNull();
  });

  it("reuses a singleton service client when configured", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    const a = createServiceClient();
    const b = createServiceClient();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("falls back to the authenticated client for message RPCs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const userClient = { tag: "user" } as never;
    expect(messageRpcClient(userClient)).toBe(userClient);
  });
});

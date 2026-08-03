import { afterEach, describe, expect, it, vi } from "vitest";
import { createServiceClient, messageRpcClient } from "./admin";

describe("supabase admin helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null service client when key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(createServiceClient()).toBeNull();
  });

  it("does not fall back to authenticated client for message RPCs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const userClient = { tag: "user" } as never;
    expect(messageRpcClient(userClient)).toBeNull();
  });
});

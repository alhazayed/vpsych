import { describe, expect, it, afterEach } from "vitest";
import { createServiceClient, messageRpcClient } from "./admin";

describe("createServiceClient / messageRpcClient", () => {
  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("returns null when service role is unset", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(createServiceClient()).toBeNull();
  });

  it("falls back to the user client when service role is unset", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const userClient = { tag: "user" } as never;
    expect(messageRpcClient(userClient)).toBe(userClient);
  });
});

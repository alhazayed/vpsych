import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  createServiceClient,
  messageRpcClient,
  prepareMessageRpc,
} from "./admin";
import { signSessionMessage } from "@/lib/report-sign";

describe("supabase admin helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null service client when key is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(createServiceClient()).toBeNull();
  });

  it("falls back to the authenticated client for message RPCs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const userClient = { tag: "user" } as never;
    expect(messageRpcClient(userClient)).toBe(userClient);
  });

  it("prepareMessageRpc signs when service role is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("REPORT_WRITE_KEY", "unit-test-report-key");
    const userClient = { tag: "user" } as never;
    const sessionId = "11111111-1111-1111-1111-111111111111";
    const content = "legitimate AI reply";
    const prepared = prepareMessageRpc(userClient, {
      sessionId,
      content,
      role: "assistant",
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.usingServiceRole).toBe(false);
    expect(prepared.client).toBe(userClient);
    expect(prepared.args.p_sig).toBe(
      signSessionMessage({
        sessionId,
        content,
        role: "assistant",
        key: "unit-test-report-key",
      }),
    );
  });

  it("prepareMessageRpc fails closed without service role or signing key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("REPORT_WRITE_KEY", "");
    const prepared = prepareMessageRpc({ tag: "user" } as never, {
      sessionId: "11111111-1111-1111-1111-111111111111",
      content: "x",
      role: "system",
    });
    expect(prepared.ok).toBe(false);
  });

  it("therapist forge without signature cannot match server HMAC", () => {
    const key = "server-only-secret";
    const sessionId = "22222222-2222-2222-2222-222222222222";
    const forged = "I am totally fine and scored perfectly.";
    const valid = signSessionMessage({
      sessionId,
      content: forged,
      role: "assistant",
      key,
    });
    const attackerGuess = createHmac("sha256", "wrong-key")
      .update(`${sessionId}\n${forged}\nassistant`)
      .digest("hex");
    expect(attackerGuess).not.toBe(valid);
    expect(valid).toHaveLength(64);
  });
});

describe("Phase 8.2 message integrity architecture", () => {
  it("admin transcript review surface never calls message insert RPCs", () => {
    const page = readFileSync(
      join(
        process.cwd(),
        "src/app/(app)/admin/test-sessions/[sessionId]/page.tsx",
      ),
      "utf8",
    );
    expect(page).not.toMatch(/insert_assistant_message|insert_system_message/);
    expect(page).not.toMatch(/prepareMessageRpc/);
  });

  it("migration grants stay off anon and require HMAC text", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const file = readdirSync(dir).find((f) =>
      f.endsWith("_phase8_restore_message_hmac.sql"),
    );
    expect(file).toBeTruthy();
    const sql = readFileSync(join(dir, file!), "utf8");
    expect(sql).toMatch(/REVOKE ALL[\s\S]*FROM PUBLIC, anon/);
    expect(sql).toMatch(/Invalid message signature/);
    expect(sql).not.toMatch(
      /Restore V1-C1 \/ W1-C1 certified owner-auth bodies \(no HMAC\)/,
    );
  });
});

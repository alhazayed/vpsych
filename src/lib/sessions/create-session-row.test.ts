import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const service = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => service.client,
}));

import {
  buildSessionRowSignaturePayload,
  createSessionRow,
  signSessionRow,
} from "@/lib/sessions/create-session-row";

type Call = { name: string; args: Record<string, unknown> };

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const inserts: Array<Record<string, unknown>> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return result;
    },
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, ...row });
        return {
          select: () => ({
            single: async () => ({ data: { id: "direct-id" }, error: null }),
          }),
        };
      },
    }),
  };
  return { client: client as unknown as SupabaseClient, calls, inserts };
}

const row = { therapist_id: "u1", avatar_id: "a1", clinical_snapshot: { locale: "en-US" } };

afterEach(() => {
  vi.unstubAllEnvs();
  service.client = null;
});

describe("createSessionRow", () => {
  it("signs the exact row text with the report write key", async () => {
    vi.stubEnv("REPORT_WRITE_KEY", "unit-key");
    const user = fakeClient({ data: "new-id", error: null });
    const res = await createSessionRow(user.client, row);
    expect(res).toEqual({ data: { id: "new-id" }, error: null });
    expect(user.calls).toHaveLength(1);
    const { name, args } = user.calls[0];
    expect(name).toBe("create_signed_session");
    expect(args.p_row).toBe(JSON.stringify(row));
    const expected = createHmac("sha256", "unit-key")
      .update(`session\n${JSON.stringify(row)}`)
      .digest("hex");
    expect(args.p_sig).toBe(expected);
  });

  it("uses the service role unsigned when no key is set", async () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    const svc = fakeClient({ data: "svc-id", error: null });
    service.client = svc.client;
    const user = fakeClient({ data: null, error: null });
    const res = await createSessionRow(user.client, row);
    expect(res.data).toEqual({ id: "svc-id" });
    expect(user.calls).toHaveLength(0);
    expect(svc.calls[0].args).not.toHaveProperty("p_sig");
  });

  it("refuses to start without a key or service role", async () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    const user = fakeClient({ data: null, error: null });
    const res = await createSessionRow(user.client, row);
    expect(res.data).toBeNull();
    expect(res.error?.message).toMatch(/signing unavailable/i);
    expect(user.calls).toHaveLength(0);
    expect(user.inserts).toHaveLength(0);
  });

  it("falls back to the direct insert only while the function is missing", async () => {
    vi.stubEnv("REPORT_WRITE_KEY", "unit-key");
    const missing = fakeClient({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    expect((await createSessionRow(missing.client, row)).data).toEqual({ id: "direct-id" });
    expect(missing.inserts).toHaveLength(1);

    const refused = fakeClient({
      data: null,
      error: { code: "42501", message: "skill_test_closed" },
    });
    const res = await createSessionRow(refused.client, row);
    expect(res.data).toBeNull();
    expect(res.error?.message).toBe("skill_test_closed");
    expect(refused.inserts).toHaveLength(0);
  });

  it("payload matches the SQL function", () => {
    expect(buildSessionRowSignaturePayload("{}")).toBe("session\n{}");
    expect(signSessionRow("{}", "k")).toMatch(/^[0-9a-f]{64}$/);
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261101170000_signed_session_create.sql"),
      "utf8",
    );
    expect(sql).toContain("extensions.hmac('session' || E'\\n' || p_row, v_key, 'sha256')");
  });

  it("the start route creates sessions only through the signed helper", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/sessions/route.ts"),
      "utf8",
    );
    expect(route).toContain("await createSessionRow(supabase, insertPayload)");
    expect(route).not.toMatch(/\.from\("sessions"\)\s*\.insert\(/);
  });
});

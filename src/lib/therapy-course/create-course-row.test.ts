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
  buildCourseRowSignaturePayload,
  createCourseRow,
  signCourseRow,
} from "@/lib/therapy-course/create-course-row";

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

const row = {
  therapist_id: "u1",
  avatar_id: "a1",
  clinical_snapshot: { locale: "en-US" },
  status: "active",
};

afterEach(() => {
  vi.unstubAllEnvs();
  service.client = null;
});

describe("createCourseRow", () => {
  it("signs the exact row text with the report write key", async () => {
    vi.stubEnv("REPORT_WRITE_KEY", "unit-key");
    const user = fakeClient({ data: "course-id", error: null });
    const res = await createCourseRow(user.client, row);
    expect(res).toEqual({ id: "course-id", error: null });
    expect(user.calls).toHaveLength(1);
    const { name, args } = user.calls[0];
    expect(name).toBe("create_signed_therapy_course");
    expect(args.p_row).toBe(JSON.stringify(row));
    const expected = createHmac("sha256", "unit-key")
      .update(`therapy_course\n${JSON.stringify(row)}`)
      .digest("hex");
    expect(args.p_sig).toBe(expected);
    expect(user.inserts).toHaveLength(0);
  });

  it("uses the service role unsigned when no key is set", async () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    const svc = fakeClient({ data: "svc-id", error: null });
    service.client = svc.client;
    const user = fakeClient({ data: null, error: null });
    const res = await createCourseRow(user.client, row);
    expect(res.id).toBe("svc-id");
    expect(user.calls).toHaveLength(0);
    expect(svc.calls[0].args).not.toHaveProperty("p_sig");
  });

  it("refuses without a key or service role", async () => {
    vi.stubEnv("REPORT_WRITE_KEY", "");
    const user = fakeClient({ data: null, error: null });
    const res = await createCourseRow(user.client, row);
    expect(res.id).toBeNull();
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
    expect((await createCourseRow(missing.client, row)).id).toBe("direct-id");
    expect(missing.inserts).toHaveLength(1);

    const refused = fakeClient({
      data: null,
      error: { code: "42501", message: "therapy_course_signature_invalid" },
    });
    const res = await createCourseRow(refused.client, row);
    expect(res.id).toBeNull();
    expect(res.error?.message).toBe("therapy_course_signature_invalid");
    expect(refused.inserts).toHaveLength(0);
  });

  it("payload matches the SQL function", () => {
    expect(buildCourseRowSignaturePayload("{}")).toBe("therapy_course\n{}");
    expect(signCourseRow("{}", "k")).toMatch(/^[0-9a-f]{64}$/);
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20261102080000_signed_therapy_course_create.sql",
      ),
      "utf8",
    );
    expect(sql).toContain(
      "extensions.hmac('therapy_course' || E'\\n' || p_row, v_key, 'sha256')",
    );
  });

  it("courses are created only through the signed helper", () => {
    const persist = readFileSync(
      join(process.cwd(), "src/lib/therapy-course/persist.ts"),
      "utf8",
    );
    expect(persist).toContain("await createCourseRow(supabase, {");
    expect(persist).not.toMatch(/\.from\("therapy_courses"\)\s*\.insert\(/);
  });
});

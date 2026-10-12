/**
 * Route-level input checks for /api/cge/rca (OWASP review finding #10):
 * `observedFailure` must look like a graph node id before it is analysed or
 * stored on a remediation plan.
 */
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cge/rca/route";

const state = vi.hoisted(() => ({ inserts: [] as Record<string, unknown>[] }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
      }),
    },
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        state.inserts.push(row);
        return { error: null };
      },
    }),
  }),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
}));
vi.mock("@/lib/ace/persist", () => ({
  ensureLearnerProfile: async () => ({ id: "learner-1", competencies: [] }),
}));

const rca = (body: unknown) =>
  POST(
    new Request("http://localhost/api/cge/rca", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/cge/rca input checks", () => {
  it("stores a remediation plan for a graph node id", async () => {
    state.inserts = [];
    const res = await rca({ observedFailure: "suicide_assessment", action: "remediation" });
    expect(res.status).toBe(200);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]?.observed_failure).toBe("suicide_assessment");
  });

  it("refuses free text, an unknown action and a broken body without storing anything", async () => {
    state.inserts = [];
    expect(
      (await rca({ observedFailure: "x".repeat(5000), action: "remediation" })).status,
    ).toBe(400);
    expect(
      (await rca({ observedFailure: "<img src=x onerror=alert(1)>", action: "remediation" }))
        .status,
    ).toBe(400);
    expect((await rca({ action: "drop" })).status).toBe(400);
    expect((await rca("{not json")).status).toBe(400);
    expect(state.inserts).toEqual([]);
  });
});

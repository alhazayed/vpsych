/**
 * The crisis escalation block reaches the Patient Agent through the shared
 * clinical turn, only for active-ideation cases, and only on the fixed reply.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, fakeSupabase, post } from "@/lib/sessions/__fixtures__/route-fakes";
import { CRISIS_ESCALATION_MARKER, ESCALATION_REPLY } from "./crisis-escalation";

const state = vi.hoisted(() => ({
  supabase: null as unknown,
  detailed: [] as Array<(input: Record<string, unknown>) => unknown>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => state.supabase,
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => ({ ok: true, retryAfterSec: 0 }),
}));
vi.mock("@/lib/ai/patient-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/patient-agent")>();
  return {
    ...actual,
    generatePatientReplyDetailed: vi.fn(async (input: Record<string, unknown>) => {
      const next = state.detailed.shift();
      if (!next) throw new Error("unexpected generation");
      return next(input);
    }),
  };
});

function history(replies: number) {
  return Array.from({ length: replies }, (_, i) => [
    { role: "user", content: `Question ${i + 1}?` },
    { role: "assistant", content: `Answer ${i + 1}.` },
  ]).flat();
}

async function promptFor(opts: { ideation: string; priorReplies: number }) {
  vi.stubEnv("CBE_ENABLED", "false");
  state.supabase = fakeSupabase({
    snapshot: {
      clinical_core: { risk_profile: { suicidal_ideation: opts.ideation } },
    },
    history: history(opts.priorReplies),
  }).client;
  const seen: Array<Record<string, unknown>> = [];
  state.detailed.push((i) => (seen.push(i), { text: "It has been a hard week, honestly.", aiSource: "gpt" }));
  const { POST } = await import("@/app/api/sessions/[id]/message/route");
  const res = await POST(post("message", { message: "How are things?" }), ctx);
  expect(res.status).toBe(200);
  return String((seen[0]!.avatar as { system_prompt: string }).system_prompt);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("REPORT_WRITE_KEY", "unit-test-report-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  state.detailed = [];
});

describe("crisis escalation in the patient turn", () => {
  it("escalates an active-ideation case on the fixed reply", async () => {
    const prompt = await promptFor({
      ideation: "active_with_plan",
      priorReplies: ESCALATION_REPLY - 1,
    });
    expect(prompt).toContain(`${CRISIS_ESCALATION_MARKER} (this reply)`);
  });

  it("does not escalate before the fixed reply", async () => {
    const prompt = await promptFor({ ideation: "active_with_plan", priorReplies: 1 });
    expect(prompt).not.toContain(CRISIS_ESCALATION_MARKER);
  });

  it("never escalates a passive-ideation case", async () => {
    const prompt = await promptFor({
      ideation: "passive",
      priorReplies: ESCALATION_REPLY - 1,
    });
    expect(prompt).not.toContain(CRISIS_ESCALATION_MARKER);
  });
});

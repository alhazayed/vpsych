import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chargeCourseVoiceChars,
  COURSE_VOICE_CHARS,
} from "@/lib/voice/course-voice-budget";

const USER = "11111111-1111-4111-8111-111111111111";
const COURSE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type DbError = { code?: string; message?: string } | null;

function client(opts: {
  session: { data: { therapy_course_id: string | null } | null; error: DbError };
  rpc?: { data: unknown; error: DbError };
}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain = {
    select: (...a: unknown[]) => (calls.push(["select", ...a]), chain),
    eq: (...a: unknown[]) => (calls.push(["eq", ...a]), chain),
    not: (...a: unknown[]) => (calls.push(["not", ...a]), chain),
    order: (...a: unknown[]) => (calls.push(["order", ...a]), chain),
    limit: (...a: unknown[]) => (calls.push(["limit", ...a]), chain),
    maybeSingle: async () => opts.session,
  };
  const rpc = vi.fn(async () => opts.rpc ?? { data: true, error: null });
  const from = vi.fn(() => chain);
  return { client: { from, rpc } as unknown as SupabaseClient, rpc, calls };
}

describe("chargeCourseVoiceChars", () => {
  it("does nothing when no course session is active", async () => {
    const c = client({ session: { data: null, error: null } });
    expect(await chargeCourseVoiceChars(c.client, USER, "hello")).toEqual({
      ok: true,
      courseId: null,
    });
    expect(c.rpc).not.toHaveBeenCalled();
    expect(c.calls).toContainEqual(["eq", "therapist_id", USER]);
    expect(c.calls).toContainEqual(["eq", "status", "active"]);
  });

  it("charges the active course with the text length and the course cap", async () => {
    const c = client({ session: { data: { therapy_course_id: COURSE }, error: null } });
    expect(await chargeCourseVoiceChars(c.client, USER, "I feel tired.")).toEqual({
      ok: true,
      courseId: COURSE,
    });
    expect(c.rpc).toHaveBeenCalledWith("charge_course_voice", {
      p_course_id: COURSE,
      p_chars: "I feel tired.".length,
      p_cap: COURSE_VOICE_CHARS,
    });
  });

  it("refuses when the database says the allowance is used up", async () => {
    const c = client({
      session: { data: { therapy_course_id: COURSE }, error: null },
      rpc: { data: false, error: null },
    });
    expect(await chargeCourseVoiceChars(c.client, USER, "more")).toEqual({
      ok: false,
      courseId: COURSE,
    });
  });

  it("lets the voice through but reports when the count cannot be written", async () => {
    const c = client({
      session: { data: { therapy_course_id: COURSE }, error: null },
      rpc: { data: null, error: { code: "PGRST202", message: "function not found" } },
    });
    expect(await chargeCourseVoiceChars(c.client, USER, "more")).toEqual({
      ok: true,
      courseId: COURSE,
      unavailable: "PGRST202",
    });
  });

  it("lets the voice through but reports when the session cannot be read", async () => {
    const c = client({ session: { data: null, error: { code: "57014" } } });
    expect(await chargeCourseVoiceChars(c.client, USER, "more")).toEqual({
      ok: true,
      courseId: null,
      unavailable: "57014",
    });
  });
});

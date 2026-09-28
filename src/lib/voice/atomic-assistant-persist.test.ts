import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { isAssistantPersistTipCurrent } from "@/lib/voice/stale-assistant-guard";
import { isAssistantPersistSupersededError } from "@/lib/supabase/admin";
import { submitConversationTurn } from "@/lib/voice/conversation-pipeline";

/**
 * Phase 9.1S — models the atomic tip check that runs inside
 * insert_assistant_message under sessions FOR UPDATE.
 *
 * We cannot execute Postgres here; this mirrors the SQL predicate and the
 * required call ordering so the previously-open TOCTOU race is proven closed
 * at the contract level.
 */
function atomicInsertAssistant(params: {
  tip: { id: string; role: string } | null;
  p_user_message_id: string;
  content: string;
  transcript: Array<{ id: string; role: string; content: string }>;
}): { ok: true } | { ok: false; reason: "superseded" | "bad_tip" } {
  if (
    !isAssistantPersistTipCurrent({
      expectedUserMessageId: params.p_user_message_id,
      tip: params.tip,
    })
  ) {
    if (params.tip && params.tip.role === "user") {
      return { ok: false, reason: "superseded" };
    }
    return { ok: false, reason: "bad_tip" };
  }
  params.transcript.push({
    id: `asst-${params.p_user_message_id}`,
    role: "assistant",
    content: params.content,
  });
  return { ok: true };
}

describe("Phase 9.1S atomic assistant tip guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("migration replaces insert_assistant_message with p_user_message_id", () => {
    const dir = join(process.cwd(), "supabase/migrations");
    const file = readdirSync(dir).find((f) =>
      f.includes("phase91s_atomic_assistant_tip_guard"),
    );
    expect(file).toBeTruthy();
    const sql = readFileSync(join(dir, file!), "utf8");
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.insert_assistant_message\(uuid, text, text\)/);
    expect(sql).toMatch(/p_user_message_id uuid/);
    expect(sql).toMatch(/Turn superseded/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(sql).toMatch(/v_tip\.id IS DISTINCT FROM p_user_message_id/);
    expect(sql).toMatch(/SECURITY DEFINER/);
  });

  it("race: app tip check would pass but B inserts before A RPC — A rejected, B succeeds", () => {
    const transcript: Array<{ id: string; role: string; content: string }> = [];
    transcript.push({ id: "user-a", role: "user", content: "A" });

    // A: application tip check sees User A
    const tipAtAppCheckA = transcript[transcript.length - 1]!;
    expect(
      isAssistantPersistTipCurrent({
        expectedUserMessageId: "user-a",
        tip: tipAtAppCheckA,
      }),
    ).toBe(true);

    // B: User B inserted (concurrent)
    transcript.push({ id: "user-b", role: "user", content: "B" });

    // A: insert_assistant_message(session, User A, Assistant A) — atomic tip
    const tipNow = transcript[transcript.length - 1]!;
    const aResult = atomicInsertAssistant({
      tip: tipNow,
      p_user_message_id: "user-a",
      content: "Assistant A",
      transcript,
    });
    expect(aResult).toEqual({ ok: false, reason: "superseded" });

    // B: insert_assistant_message(session, User B, Assistant B)
    const bResult = atomicInsertAssistant({
      tip: transcript[transcript.length - 1]!,
      p_user_message_id: "user-b",
      content: "Assistant B",
      transcript,
    });
    expect(bResult).toEqual({ ok: true });

    expect(transcript.map((m) => `${m.role}:${m.id}`)).toEqual([
      "user:user-a",
      "user:user-b",
      "assistant:asst-user-b",
    ]);
    expect(transcript.some((m) => m.content === "Assistant A")).toBe(false);
  });

  it("completed-turn race: User A → User B → Assistant B → late Assistant A rejected", () => {
    const transcript: Array<{ id: string; role: string; content: string }> = [
      { id: "user-a", role: "user", content: "A" },
      { id: "user-b", role: "user", content: "B" },
    ];
    expect(
      atomicInsertAssistant({
        tip: transcript[transcript.length - 1]!,
        p_user_message_id: "user-b",
        content: "Assistant B",
        transcript,
      }).ok,
    ).toBe(true);

    // Tip is now assistant — SQL rejects with preceding-user-turn / not superseded.
    const lateA = atomicInsertAssistant({
      tip: transcript[transcript.length - 1]!,
      p_user_message_id: "user-a",
      content: "Assistant A",
      transcript,
    });
    expect(lateA.ok).toBe(false);
    expect(transcript.filter((m) => m.role === "assistant")).toHaveLength(1);
    expect(transcript[transcript.length - 1]?.content).toBe("Assistant B");
  });

  it("normal path: User A → Assistant A still succeeds", () => {
    const transcript: Array<{ id: string; role: string; content: string }> = [
      { id: "user-a", role: "user", content: "A" },
    ];
    expect(
      atomicInsertAssistant({
        tip: transcript[0]!,
        p_user_message_id: "user-a",
        content: "Assistant A",
        transcript,
      }).ok,
    ).toBe(true);
    expect(transcript.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("normal sequential turns: A then B both succeed", () => {
    const transcript: Array<{ id: string; role: string; content: string }> = [];
    transcript.push({ id: "user-a", role: "user", content: "A" });
    expect(
      atomicInsertAssistant({
        tip: transcript[transcript.length - 1]!,
        p_user_message_id: "user-a",
        content: "Assistant A",
        transcript,
      }).ok,
    ).toBe(true);
    transcript.push({ id: "user-b", role: "user", content: "B" });
    expect(
      atomicInsertAssistant({
        tip: transcript[transcript.length - 1]!,
        p_user_message_id: "user-b",
        content: "Assistant B",
        transcript,
      }).ok,
    ).toBe(true);
    expect(transcript.map((m) => `${m.role}:${m.content}`)).toEqual([
      "user:A",
      "assistant:Assistant A",
      "user:B",
      "assistant:Assistant B",
    ]);
  });

  it("route response: superseded 409 is treated as stale, not clinical error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: "Turn superseded", superseded: true },
          { status: 409 },
        ),
      ),
    );
    const result = await submitConversationTurn({
      sessionId: "s1",
      message: "late",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.superseded).toBe(true);
    expect(result.aborted).toBe(true);
    expect(result.status).toBe(409);
  });

  it("isAssistantPersistSupersededError maps RPC exception text", () => {
    expect(
      isAssistantPersistSupersededError({
        message: "Turn superseded",
        code: "P0001",
      }),
    ).toBe(true);
  });
});

/**
 * Test-only fakes for the session message routes: an in-memory Supabase
 * client (sessions / session_messages / RPC capture) plus SSE helpers.
 * Engines that read other tables get `{ data: null }`, exactly as they would
 * from a missing table, and soft-fail the same way.
 */
import type { Avatar } from "@/lib/types";
import { createSseParser } from "@/lib/realtime/sse-parser";

export type RpcCall = { name: string; args: Record<string, unknown> };

export const SESSION_ID = "11111111-1111-4111-8111-111111111111";
export const USER_ID = "22222222-2222-4222-8222-222222222222";
export const USER_MSG_ID = "33333333-3333-4333-8333-333333333333";

export const avatar: Avatar = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "Legacy Patient",
  disorder: "GAD",
  age: 30,
  gender: "male",
  portrait_url: null,
  persona_prompt: "You are a legacy v1 patient.",
  ideal_guidelines: { session_goals: ["Assess worry"] },
  rubric: [{ id: "alliance", label: "Alliance", weight: 100, max: 5 }],
  schema_version: 1,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function fakeSupabase(
  opts: {
    status?: string;
    owner?: string;
    snapshot?: Record<string, unknown> | null;
    /** Earlier transcript rows already in the session. */
    history?: Array<{ role: string; content: string }>;
  } = {},
) {
  const rpcCalls: RpcCall[] = [];
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const messages: Array<Record<string, unknown>> = [...(opts.history ?? [])];
  const session = {
    id: SESSION_ID,
    therapist_id: opts.owner ?? USER_ID,
    avatar_id: avatar.id,
    status: opts.status ?? "active",
    language: "en",
    started_at: new Date().toISOString(),
    max_duration_sec: 2400,
    case_instance_id: null,
    clinical_snapshot: opts.snapshot ?? null,
    avatars: avatar,
  };

  const from = (table: string) => {
    let op: "select" | "insert" | "upsert" | "update" = "select";
    let payload: Record<string, unknown> | null = null;
    const resolve = () => {
      if (table === "sessions" && op === "select") return { data: session, error: null };
      if (table === "session_messages" && op === "insert" && payload) {
        const row = {
          id: USER_MSG_ID,
          created_at: new Date().toISOString(),
          ...payload,
        };
        messages.push(row);
        inserts.push({ table, row });
        return { data: row, error: null };
      }
      if (table === "session_messages" && op === "select") {
        return { data: messages.map((m) => ({ role: m.role, content: m.content })), error: null };
      }
      return { data: null, error: null };
    };
    const api: Record<string, unknown> = {};
    const chain = () => api;
    for (const m of ["select", "eq", "neq", "in", "order", "limit", "gte", "lte", "is", "not", "or", "filter", "match", "range"]) {
      api[m] = chain;
    }
    api.insert = (row: Record<string, unknown>) => {
      op = "insert";
      payload = row;
      return api;
    };
    api.upsert = (row: Record<string, unknown>) => {
      op = "upsert";
      payload = row;
      return api;
    };
    api.update = (row: Record<string, unknown>) => {
      op = "update";
      payload = row;
      return api;
    };
    api.single = async () => resolve();
    api.maybeSingle = async () => resolve();
    api.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(ok, err);
    return api;
  };

  return {
    rpcCalls,
    inserts,
    client: {
      auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
      from,
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args });
        if (name === "insert_assistant_message") {
          return {
            data: {
              id: "assistant-msg-1",
              session_id: SESSION_ID,
              role: "assistant",
              content: args.p_content,
              created_at: new Date().toISOString(),
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    },
  };
}

export const ctx = { params: Promise.resolve({ id: SESSION_ID }) };

export function post(path: string, body: unknown, signal?: AbortSignal) {
  return new Request(`http://localhost/api/sessions/${SESSION_ID}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

export type Ev = { type: string; sequence: number; payload: Record<string, unknown> };

export async function readSse(
  res: Response,
  onEvent?: (e: Ev) => void,
): Promise<Ev[]> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  const out: Ev[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const msg of parser.push(decoder.decode(value, { stream: true }))) {
      const e = JSON.parse(msg.data) as Ev;
      out.push(e);
      onEvent?.(e);
    }
  }
  return out;
}


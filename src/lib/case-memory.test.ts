import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mergeCaseMemory } from "@/lib/case-memory";

/** In-memory case_memory table with a controllable read error and delay. */
function fakeDb(initial: Record<string, unknown> | null) {
  const db = {
    memory: initial,
    readError: null as { message: string } | null,
    writes: 0,
  };
  const client = {
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          if (db.readError) return { data: null, error: db.readError };
          return {
            data: db.memory ? { memory: structuredClone(db.memory) } : null,
            error: null,
          };
        },
        upsert: async (row: { memory: Record<string, unknown> }) => {
          await new Promise((r) => setTimeout(r, Math.random() * 5));
          db.writes += 1;
          db.memory = row.memory;
          return { error: null };
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
  return { db, client };
}

describe("mergeCaseMemory", () => {
  it("keeps other engines' namespaces when one engine saves", async () => {
    const { db, client } = fakeDb({ emotion: { mood: 3 }, patient_adaptation: { trust: 1 } });
    await mergeCaseMemory(client, "case-1", "test", (m) => ({ ...m, clinical_intelligence: { v: 1 } }));
    expect(db.memory).toEqual({
      emotion: { mood: 3 },
      patient_adaptation: { trust: 1 },
      clinical_intelligence: { v: 1 },
    });
  });

  it("never writes when the current row cannot be read", async () => {
    const { db, client } = fakeDb({ emotion: { mood: 3 } });
    db.readError = { message: "timeout" };
    const ok = await mergeCaseMemory(client, "case-1", "test", () => ({}));
    expect(ok).toBe(false);
    expect(db.writes).toBe(0);
    expect(db.memory).toEqual({ emotion: { mood: 3 } });
  });

  it("applies fire-and-forget saves for one case in order, without losing any", async () => {
    const { db, client } = fakeDb({});
    const saves = ["adaptation", "emotion", "mind"].map((key) =>
      mergeCaseMemory(client, "case-1", key, (m) => ({ ...m, [key]: true })),
    );
    await Promise.all(saves);
    expect(db.memory).toEqual({ adaptation: true, emotion: true, mind: true });
  });
});
